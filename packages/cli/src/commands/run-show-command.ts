import { renderShow } from '../reads/render-show.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, Store } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import type { UnreadRows } from './format-unread-note.ts';

// Prints one item, closed item or decision. A read is never refused once the session is found, so
// an id it does not know prints the open items instead.
export async function runShowCommand(
  store: Store,
  id: string,
  nowMs: number,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  const rows = await readJournalRows(store.folder);

  return {
    exitCode: 0,
    stdout: renderShow({ id, store, rows, nowMs }),
    stderr: unread === null ? '' : formatUnreadNote(store.session.name, unread, 'This read'),
  };
}
