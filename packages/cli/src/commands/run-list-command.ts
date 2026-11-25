import { buildReplyBriefInput } from '../brief/build-reply-brief-input.ts';
import { buildListJSON } from '../json/build-list-json.ts';
import { formatJSONOutput } from '../json/format-json-output.ts';
import { renderList } from '../reads/render-list.ts';
import type { ListKind } from '../rules/list-kinds.ts';
import type { CommandResult, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import { readDecisions } from './read-decisions.ts';
import type { CommandContext } from './types.ts';

// Lists every open row of one kind, whole. It runs no check, takes no lock and writes nothing, so
// each tag shows the result the last read saved. A file that does not parse is named on stderr.
export async function runListCommand(
  store: Store,
  kind: ListKind,
  context: CommandContext,
  unread: UnreadRows | null,
): Promise<CommandResult> {
  const decided = kind === 'decisions' ? await readDecisions(store.folder) : null;

  const input = buildReplyBriefInput(store, {
    nowMs: context.nowMs,
    sessionFlag: context.args.sessionFlag,
    host: null,
    decisions: decided?.decisions ?? [],
  });

  const stderr = [
    unread,
    store.notesUnread,
    store.ownerUnread,
    store.prsUnread,
    store.lessonsUnread,
    store.promisesUnread,
    store.wordsUnread,
    decided?.unread ?? null,
  ]
    .flatMap((rows) =>
      rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'This read')],
    )
    .join('');

  if (context.args.values.json === true) {
    return {
      exitCode: 0,
      stdout: formatJSONOutput(
        buildListJSON(kind, {
          brief: input,
          prs: store.prs,
          decideRows: decided?.rows ?? [],
        }),
      ),
      stderr,
      stdoutFormat: 'json',
    };
  }

  return { exitCode: 0, stdout: renderList(kind, input), stderr };
}
