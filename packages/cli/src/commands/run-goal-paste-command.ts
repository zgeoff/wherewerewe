import { join } from 'node:path';
import { match } from 'ts-pattern';
import { renderGoalPaste } from '../reads/render-goal-paste.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { readSessionFile } from '../store/read-session-file.ts';
import type { CommandResult } from '../types.ts';
import { refuseNoSession } from './refuse-no-session.ts';
import type { CommandContext } from './types.ts';

// Prints the grant of a session as a /goal text. It reads the `session` file alone, runs no check,
// takes no lock and writes nothing.
export async function runGoalPasteCommand(
  context: CommandContext,
  name: string,
): Promise<CommandResult> {
  const folder = join(context.root, name);
  const scope = buildRefusalScope(context.args, context.cwd);
  const read = isSessionName(name) ? await readSessionFile(folder) : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'session' }, (found) =>
      found.session.grant === null
        ? buildRefusalResult(buildRefusal({ kind: 'no-grant-to-print', name }), scope)
        : {
            exitCode: 0 as const,
            stdout: renderGoalPaste(found.session.grant, name),
            stderr: '',
            stdoutFormat: 'text' as const,
          },
    )
    .with({ kind: 'missing' }, () => refuseNoSession(context, name))
    .with({ kind: 'hand-kept' }, { kind: 'format-1' }, { kind: 'newer' }, (unreadable) =>
      buildRefusalResult(buildReadRefusal(unreadable, { name, folder }), scope),
    )
    .with({ kind: 'broken' }, (broken) =>
      buildRefusalResult(
        buildReadRefusal(
          { ...broken, file: 'session', line: null, partial: null },
          { name, folder },
        ),
        scope,
      ),
    )
    .exhaustive();
}
