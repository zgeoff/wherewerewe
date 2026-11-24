import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import type { FileKind, RefusalReason, Store } from '../types.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickBrokenFileRefusal } from './pick-broken-file-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// A done, drop or use on an id that holds a lesson, a promise or the owner's words, or null when
// the id holds none. A lesson and the owner's words close with drop only. The row leaves its file,
// and one journal row keeps its text and the reason.
export function pickFileClose(
  input: WriteInput,
  command: 'done' | 'drop' | 'use',
  id: string,
  why: string,
): WriteResult | null {
  const store = input.store;
  const row = findFileRow(store, id);

  if (row === null) {
    return pickUnknownIDRefusal(store);
  }

  const reason = pickFileCloseRefusal(store, command, id, row.kind);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(input.nowMs);
  const isRetry = isRetryOfClose(input, command, id, row);
  const verb = command === 'done' ? 'done' : 'dropped';

  return {
    kind: 'write',
    change: {
      ...(row.kind === 'lesson'
        ? { lessons: store.lessons.filter((lesson) => lesson.id !== id) }
        : {}),
      ...(row.kind === 'promise'
        ? { promises: store.promises.filter((promise) => promise.id !== id) }
        : {}),
      ...(row.kind === 'words' ? { words: store.words.filter((words) => words.id !== id) } : {}),
      journal: isRetry
        ? []
        : [{ ts, op: command, id, by: 'agent', text: row.text, why, extra: null }],
    },
    reply: (figure) =>
      `${id}  ${verb}. Off the brief, kept in the journal. ${formatBriefLine(figure)}`,
  };
}

interface FileRow {
  readonly kind: FileKind;
  readonly text: string;
  readonly written: string;
}

function findFileRow(store: Store, id: string): FileRow | null {
  const lesson = store.lessons.find((row) => row.id === id);
  const promise = store.promises.find((row) => row.id === id);
  const words = store.words.find((row) => row.id === id);

  if (lesson !== undefined) {
    return { kind: 'lesson', text: lesson.text, written: lesson.written };
  }

  if (promise !== undefined) {
    return { kind: 'promise', text: promise.what, written: promise.written };
  }

  return words === undefined ? null : { kind: 'words', text: words.words, written: words.written };
}

// An id open in no file may be the row a broken file left out, so a store with a broken file of
// the three refuses the close, and any other id gets no-open-item from the caller.
function pickUnknownIDRefusal(store: Store): WriteResult | null {
  const reason =
    pickBrokenFileRefusal(store, 'lesson') ??
    pickBrokenFileRefusal(store, 'promise') ??
    pickBrokenFileRefusal(store, 'words');

  return reason === null ? null : { kind: 'refused', refusal: buildRefusal(reason) };
}

function pickFileCloseRefusal(
  store: Store,
  command: 'done' | 'drop' | 'use',
  id: string,
  kind: FileKind,
): RefusalReason | null {
  if (command === 'use') {
    return { kind: 'use-not-approval', id, itemKind: kind };
  }

  if (command === 'done' && kind !== 'promise') {
    return { kind: 'close-kind', id, itemKind: kind };
  }

  return pickBrokenFileRefusal(store, kind);
}

// An interrupted close wrote its journal row and left the row in its file, so the retry adds no
// second journal row. Only a close of the same op, with the row's text, after the row was written,
// counts: an earlier close of another row under the same id, such as a task's, is not this row's.
function isRetryOfClose(
  input: WriteInput,
  command: 'done' | 'drop' | 'use',
  id: string,
  row: FileRow,
): boolean {
  const earlier = input.journal.closeRows.get(id);

  return (
    earlier !== undefined &&
    earlier.op === command &&
    earlier.text === row.text &&
    Date.parse(earlier.ts) >= Date.parse(row.written)
  );
}
