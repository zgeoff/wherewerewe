import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

export function pickGoalWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const goal = args.positionals[0] ?? '';

  const reason = pickTextRefusal(
    args,
    [{ target: { label: 'goal', place: { positional: 0 } }, text: goal, limit: 200 }],
    false,
  );

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
    reply: (briefLines) => `goal set. Brief: ${String(briefLines)} lines.`,
  };
}
