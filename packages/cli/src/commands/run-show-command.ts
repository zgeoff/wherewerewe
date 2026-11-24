import { parseCheckTarget } from '../checks/parse-check-target.ts';
import { probeCheck } from '../checks/probe-check.ts';
import { createKillSet, runCommand } from '../checks/run-command.ts';
import { isShowRow } from '../reads/is-show-row.ts';
import { renderShow } from '../reads/render-show.ts';
import type { ShowInput } from '../reads/render-show.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, JournalRow, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import type { CommandContext } from './types.ts';

// Prints one item, probing its check when it has one. It saves nothing and takes no lock.
export async function runShowCommand(
  store: Store,
  id: string,
  context: CommandContext,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  let rows: JournalRow[] = [];

  let closed: ReadonlyMap<string, string> = new Map();

  let journalUnread: UnreadRows | null = null;

  try {
    rows = await readJournalRows(store.folder, (row) => isShowRow(row, id));

    const index = await readJournalIndex(store.folder);

    closed = index.closed;
  } catch (error) {
    journalUnread = {
      file: 'journal.tsv',
      line: null,
      reason: error instanceof Error && 'code' in error ? String(error.code) : 'read failed',
    };
  }

  const notes = [unread, store.notesUnread, journalUnread].flatMap((found) =>
    found === null ? [] : [formatUnreadNote(store.session.name, found, 'This read')],
  );

  return {
    exitCode: 0,
    stdout: renderShow({
      id,
      store,
      rows,
      closed,
      nowMs: context.nowMs,
      checkNow: await runItemProbe(store, id, context.env),
    }),
    stderr: notes.join(''),
  };
}

async function runItemProbe(
  store: Store,
  id: string,
  env: Readonly<Record<string, string | undefined>>,
): Promise<ShowInput['checkNow']> {
  const item = store.items.find((candidate) => candidate.id === id);
  const target = item?.check === null || item === undefined ? null : parseCheckTarget(item.check);

  if (item === undefined || target === null) {
    return null;
  }

  const kills = createKillSet();

  const probe = await probeCheck(target, {
    extra: item.extra,
    run: (argv, timeoutMs) => runCommand(argv, { env, timeoutMs, kills }),
  });

  return {
    result: probe.result.kind === 'result' ? probe.result.result : 'unchecked',
    failing: probe.failing,
  };
}
