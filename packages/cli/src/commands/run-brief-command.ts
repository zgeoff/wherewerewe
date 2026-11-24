import { buildBriefInput } from '../brief/build-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import { findAgentID } from '../sessions/find-agent-id.ts';
import type { CLIResult, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import type { CommandContext } from './types.ts';

// Prints the brief. This slice runs no check and saves nothing, so it takes no lock. A file that
// does not parse is never a refusal for a read: the brief prints what it can and says on stderr
// what it left out.
export function runBriefCommand(
  store: Store,
  context: CommandContext,
  unread: UnreadRows | null,
): CLIResult {
  return {
    exitCode: 0,
    stdout: renderBrief(
      buildBriefInput(
        store,
        context.nowMs,
        context.args.sessionFlag,
        findAgentID(context.env)?.harness ?? null,
      ),
    ),
    stderr: [unread, store.notesUnread, store.ownerUnread]
      .flatMap((rows) =>
        rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'The brief')],
      )
      .join(''),
  };
}
