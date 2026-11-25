import { buildShowJSON } from '../json/build-show-json.ts';
import { formatJSONOutput } from '../json/format-json-output.ts';
import { renderTaskList } from '../reads/render-task-list.ts';
import type { CommandResult, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import { readDecisions } from './read-decisions.ts';
import type { CommandContext } from './types.ts';

// Lists every open task in full. It takes no lock and runs no check. The text form reads no
// journal; the JSON form reads the decisions, so each task names the ones about it.
export async function runTaskListCommand(
  store: Store,
  context: CommandContext,
  unread: UnreadRows | null,
): Promise<CommandResult> {
  const stderr = [unread, store.notesUnread]
    .flatMap((rows) =>
      rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'This read')],
    )
    .join('');

  if (context.args.values.json === true) {
    const decided = await readDecisions(store.folder);

    return {
      exitCode: 0,
      stdout: formatJSONOutput(
        buildShowJSON({ id: null, store, rows: decided.rows, checkNows: [] }),
      ),
      stderr,
      stdoutFormat: 'json',
    };
  }

  return {
    exitCode: 0,
    stdout: renderTaskList({
      items: store.items,
      notes: store.notes,
      focus: store.session.now,
      nowMs: context.nowMs,
    }),
    stderr,
    stdoutFormat: 'text',
  };
}
