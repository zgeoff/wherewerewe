import { buildBriefInput } from '../brief/build-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import type { CLIResult, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';

// Prints the brief. This slice runs no check and saves nothing, so it takes no lock. A file that
// does not parse is never a refusal for a read: the brief prints what it can and says on stderr
// what it left out.
export function runBriefCommand(store: Store, nowMs: number, unread: UnreadRows | null): CLIResult {
  return {
    exitCode: 0,
    stdout: renderBrief(buildBriefInput(store, nowMs)),
    stderr: [unread, store.notesUnread, store.ownerUnread]
      .flatMap((rows) =>
        rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'The brief')],
      )
      .join(''),
  };
}
