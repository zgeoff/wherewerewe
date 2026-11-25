import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { match } from 'ts-pattern';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { parseJournalFile } from '../store/parse-journal-file.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import type { FileKind, LessonRow, PromiseRow, Store, WordsRow } from '../types.ts';
import { pickClose } from '../writes/pick-close.ts';
import { pickLessonWrite } from '../writes/pick-lesson-write.ts';
import { pickPromiseWrite } from '../writes/pick-promise-write.ts';
import { pickWordsWrite } from '../writes/pick-words-write.ts';
import type { WriteInput, WriteResult } from '../writes/types.ts';
import type { CloseModelStep } from './build-close-model-steps.ts';
import { buildMockStore } from './build-mock-store.ts';
import { buildParsedArgs } from './build-parsed-args.ts';
import { readCloseModelProblems } from './read-close-model-problems.ts';

// What one step leaves: whether the pick wrote, the invariant's problems, and the close rows of
// each id the journal holds.
export interface CloseModelState {
  readonly outcome: 'write' | 'refused';
  readonly problems: readonly string[];
  readonly closeRows: readonly number[];
}

interface CloseModelKind {
  readonly kind: FileKind;
  readonly closes: readonly ('done' | 'drop')[];
  readonly writeArgv: (id: string, text: string) => readonly string[];
  readonly pick: (input: WriteInput) => WriteResult;
  readonly readRows: (store: Store) => ReadonlyMap<string, string>;
}

const kinds: Readonly<Record<FileKind, CloseModelKind>> = {
  lesson: {
    kind: 'lesson',
    closes: ['drop'],
    writeArgv: (id, text) => ['lesson', id, text, '--why', 'A stale row passed'],
    pick: (input) => pickLessonWrite(input),
    readRows: (store) => new Map(store.lessons.map((row) => [row.id, row.text])),
  },
  promise: {
    kind: 'promise',
    closes: ['done', 'drop'],
    writeArgv: (id, text) => ['promise', id, text, '--to', 'owner', '--by', 'Friday'],
    pick: (input) => pickPromiseWrite(input),
    readRows: (store) => new Map(store.promises.map((row) => [row.id, row.what])),
  },
  words: {
    kind: 'words',
    closes: ['drop'],
    writeArgv: (id, text) => ['words', id, text, '--where', 'chat'],
    pick: (input) => pickWordsWrite({ ...input, byOwner: false }),
    readRows: (store) => new Map(store.words.map((row) => [row.id, row.words])),
  },
};

// Runs the steps on the write path past the lock, with the three files held in memory and a real
// journal file, and returns the state after each step beside the state the model expects. An
// interrupted close appends its journal rows and leaves the files as they were.
export async function runCloseModel(
  kind: FileKind,
  ids: readonly string[],
  steps: readonly CloseModelStep[],
): Promise<{ readonly actual: CloseModelState[]; readonly expected: CloseModelState[] }> {
  const temp = createTempDir('close-model', { cleanup: 'manual' });

  try {
    return await runSteps(kinds[kind], ids, steps, temp.path);
  } finally {
    temp.remove();
  }
}

// The model's view of the ids: each open id with the text its file holds and the close whose
// journal row an interrupted close of that row already wrote, the ids a close reached, and the
// close rows each id should have.
interface ModelState {
  readonly open: Map<
    string,
    { readonly text: string; readonly recordedClose: 'done' | 'drop' | null }
  >;
  readonly closed: Set<string>;
  readonly closeCounts: Map<string, number>;
}

async function runSteps(
  model: CloseModelKind,
  ids: readonly string[],
  steps: readonly CloseModelStep[],
  folder: string,
): Promise<{ readonly actual: CloseModelState[]; readonly expected: CloseModelState[] }> {
  const journalPath = join(folder, 'journal.tsv');
  const state: ModelState = { open: new Map(), closed: new Set(), closeCounts: new Map() };

  const files: { lessons: LessonRow[]; promises: PromiseRow[]; words: WordsRow[] } = {
    lessons: [],
    promises: [],
    words: [],
  };

  const base = buildMockStore({});
  const actual: CloseModelState[] = [];
  const expected: CloseModelState[] = [];
  let nowMs = Date.parse('2026-03-10T11:43:00Z');

  for (const step of steps) {
    nowMs += step.tick * 1000;

    const argv = match(step)
      .with({ op: 'write' }, (write) => model.writeArgv(write.id, write.text))
      .with({ op: 'close', command: 'done' }, (close) => [
        'done',
        close.id,
        '--evidence',
        'it shipped',
      ])
      .with({ op: 'close', command: 'drop' }, (close) => ['drop', close.id, '--why', 'it shipped'])
      .exhaustive();

    const pick = step.op === 'write' ? model.pick : pickClose;

    const picked = pick({
      store: { ...base, ...files },
      journal: await readJournalIndex(folder),
      args: buildParsedArgs(argv),
      cwd: '/work',
      nowMs,
      probed: null,
    });

    const isInterrupted = step.op === 'close' && step.isInterrupted;

    if (picked.kind === 'write') {
      appendFileSync(journalPath, formatJournalRows(picked.change.journal));
    }

    if (picked.kind === 'write' && !isInterrupted) {
      files.lessons = [...(picked.change.lessons ?? files.lessons)];
      files.promises = [...(picked.change.promises ?? files.promises)];
      files.words = [...(picked.change.words ?? files.words)];
    }

    const outcome = expectStep(model, step, state);
    const journal = existsSync(journalPath) ? readFileSync(journalPath, 'utf8') : '';
    const rows = parseJournalFile(journal);
    const fileRows = model.readRows({ ...base, ...files });

    actual.push({
      outcome: picked.kind,
      problems: readCloseModelProblems(model.kind, fileRows, journal, ids),
      closeRows: ids.map(
        (id) => rows.filter((row) => row.id === id && row.extra === `kind=${model.kind}`).length,
      ),
    });

    expected.push({
      outcome,
      problems: [],
      closeRows: ids.map((id) => state.closeCounts.get(id) ?? 0),
    });
  }

  return { actual, expected };
}

// The model, from the design's rules alone: a write of an open id replaces it, a write of an id
// closed and open nowhere is refused, a close by the kind's own command removes the row, and a
// close adds one journal row unless it retries the interrupted close of the same row and command.
function expectStep(
  model: CloseModelKind,
  step: CloseModelStep,
  state: ModelState,
): 'write' | 'refused' {
  const row = state.open.get(step.id);

  if (step.op === 'write') {
    if (row === undefined && state.closed.has(step.id)) {
      return 'refused';
    }

    state.open.set(step.id, { text: step.text, recordedClose: null });

    return 'write';
  }

  if (row === undefined || !model.closes.includes(step.command)) {
    return 'refused';
  }

  const added = row.recordedClose === step.command ? 0 : 1;

  state.closeCounts.set(step.id, (state.closeCounts.get(step.id) ?? 0) + added);
  state.closed.add(step.id);

  if (step.isInterrupted) {
    state.open.set(step.id, { text: row.text, recordedClose: step.command });
  } else {
    state.open.delete(step.id);
  }

  return 'write';
}
