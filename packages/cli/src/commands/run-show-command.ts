import { isShowRow } from '../reads/is-show-row.ts';
import { renderShow } from '../reads/render-show.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, JournalRow, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';

export async function runShowCommand(
  store: Store,
  id: string,
  nowMs: number,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  let rows: JournalRow[] = [];
  let journalUnread: UnreadRows | null = null;

  try {
    rows = await readJournalRows(store.folder, (row) => isShowRow(row, id));
  } catch (error) {
    journalUnread = {
      file: 'journal.tsv',
      line: null,
      reason: error instanceof Error && 'code' in error ? `${String(error.code)}` : 'read failed',
    };
  }

  const notes = [unread, journalUnread].flatMap((found) =>
    found === null ? [] : [formatUnreadNote(store.session.name, found, 'This read')],
  );

  return {
    exitCode: 0,
    stdout: renderShow({ id, store, rows, nowMs }),
    stderr: notes.join(''),
  };
}
