import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// done and drop: each removes the open item, clears the focus when the item was in it, and keeps
// the item's claim in the journal row.
export function pickClose(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const isDone = args.command === 'done';
  const id = args.positionals[0] ?? '';
  const flag = isDone ? 'evidence' : 'why';
  const why = isDone ? args.values.evidence : args.values.why;

  if (why !== undefined) {
    const reason = pickTextRefusal(
      args,
      [
        {
          target: { label: isDone ? 'evidence' : 'reason', place: { flag } },
          text: why,
          limit: 200,
        },
      ],
      false,
    );

    if (reason !== null) {
      return { kind: 'refused', refusal: buildRefusal(reason) };
    }
  }

  if (why === undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal({ kind: isDone ? 'needs-evidence' : 'needs-reason', args }),
    };
  }

  const item = store.items.find((candidate) => candidate.id === id);

  if (item === undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'no-open-item',
        args,
        id,
        openIDs: store.items.map((candidate) => candidate.id),
      }),
    };
  }

  const ts = formatTimestamp(nowMs);
  const wasInFocus = store.session.now === id;
  const verb = isDone ? 'done' : 'dropped';

  return {
    kind: 'write',
    change: {
      items: store.items.filter((candidate) => candidate.id !== id),
      session: {
        ...store.session,
        lastWrite: ts,
        ...(wasInFocus ? { now: null, nowNext: null, nowSet: null } : {}),
      },
      journal: [{ ts, op: args.command, id, by: 'agent', text: item.claim, why, extra: null }],
    },
    reply: (briefLines) =>
      `${id}  ${verb}. Off the brief, kept in the journal. Brief: ${String(briefLines)} lines.`,
  };
}
