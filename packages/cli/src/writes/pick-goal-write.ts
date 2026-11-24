import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

export function pickGoalWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const goal = args.positionals[0] ?? '';
  const reason = pickGoalArgsRefusal(args);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(nowMs);

  return {
    kind: 'write',
    change: {
      session: { ...store.session, goal, lastWrite: ts },
      journal: [
        { ts, op: 'goal', id: store.session.name, by: 'agent', text: goal, why: null, extra: null },
      ],
    },
    reply: (figure) => `goal set. ${formatBriefLine(figure)}`,
  };
}

// The check that reads the command line and no store: the goal's text.
export function pickGoalArgsRefusal(args: ParsedArgs): RefusalReason | null {
  return pickTextRefusal(
    args,
    [
      {
        target: { label: 'goal', place: { positional: 0 } },
        text: args.positionals[0] ?? '',
        limit: textLimits.goal,
      },
    ],
    false,
  );
}
