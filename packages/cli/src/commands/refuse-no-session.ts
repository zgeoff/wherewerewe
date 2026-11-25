import { getSessionDay } from '../brief/get-session-day.ts';
import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readSessionSummaries } from '../sessions/read-session-summaries.ts';
import type { CommandResult } from '../types.ts';
import type { CommandContext } from './types.ts';

export async function refuseNoSession(
  context: CommandContext,
  named: string | null,
): Promise<CommandResult> {
  const summaries = await readSessionSummaries(context.root);

  const refusal = buildRefusal({
    kind: 'no-session',
    named,
    sessions: summaries.map((summary) => ({
      name: summary.name,
      day: summary.started === null ? null : getSessionDay(summary.started, context.nowMs),
    })),
  });

  return buildRefusalResult(refusal, buildRefusalScope(context.args, context.cwd));
}
