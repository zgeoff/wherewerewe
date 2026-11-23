import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

export function pickNowWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const id = args.positionals[0] ?? '';
  const next = args.positionals[1] ?? '';

  const reason = pickTextRefusal(
    args,
    [{ target: { label: 'next step', place: { positional: 1 } }, text: next, limit: 120 }],
    false,
  );

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  if (!store.items.some((item) => item.id === id)) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'no-open-item',
        args,
        id,
        openIDs: store.items.map((item) => item.id),
      }),
    };
  }

  const ts = formatTimestamp(nowMs);

  return {
    kind: 'write',
    change: {
      session: { ...store.session, now: id, nowNext: next, nowSet: ts, lastWrite: ts },
      journal: [{ ts, op: 'now', id, by: 'agent', text: next, why: null, extra: null }],
    },
    reply: (briefLines) => `now: ${id}. Brief: ${String(briefLines)} lines.`,
  };
}
