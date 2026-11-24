import { renderTaskList } from '../reads/render-task-list.ts';
import type { CLIResult, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';

// Lists every open task in full. It takes no lock, runs no check and reads no journal.
export function runTaskListCommand(
  store: Store,
  nowMs: number,
  unread: UnreadRows | null,
): CLIResult {
  return {
    exitCode: 0,
    stdout: renderTaskList({
      items: store.items,
      notes: store.notes,
      focus: store.session.now,
      nowMs,
    }),
    stderr: [unread, store.notesUnread]
      .flatMap((rows) =>
        rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'This read')],
      )
      .join(''),
  };
}
