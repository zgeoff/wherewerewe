import { match } from 'ts-pattern';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import type { Item, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// done, drop and use: each removes the open item, clears the focus when the item was in it, and
// keeps the item's claim in the journal row. use spends an open --once approval.
export function pickClose(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const command = args.command === 'done' || args.command === 'use' ? args.command : 'drop';
  const id = args.positionals[0] ?? '';

  const why = match(command)
    .with('done', () => args.values.evidence)
    .with('drop', () => args.values.why)
    .with('use', () => args.values.for)
    .exhaustive();

  const flag = match(command)
    .with('done', () => 'evidence')
    .with('drop', () => 'why')
    .with('use', () => 'for')
    .exhaustive();

  const label = match(command)
    .with('done', () => 'evidence' as const)
    .with('drop', () => 'reason' as const)
    .with('use', () => '--for text' as const)
    .exhaustive();

  if (why !== undefined) {
    const reason = pickTextRefusal(
      args,
      [
        {
          target: { label, place: { flag } },
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
      refusal: buildRefusal(
        match(command)
          .with('done', (): RefusalReason => ({ kind: 'needs-evidence', args }))
          .with('drop', (): RefusalReason => ({ kind: 'needs-reason', args }))
          .with('use', (): RefusalReason => ({ kind: 'use-needs-for', args }))
          .exhaustive(),
      ),
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

  const useRefusal = command === 'use' ? pickUseRefusal(item) : null;

  if (useRefusal !== null) {
    return { kind: 'refused', refusal: buildRefusal(useRefusal) };
  }

  const ts = formatTimestamp(nowMs);
  const wasInFocus = store.session.now === id;

  const verb = match(command)
    .with('done', () => 'done')
    .with('drop', () => 'dropped')
    .with('use', () => 'used')
    .exhaustive();

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

function pickUseRefusal(item: Item): RefusalReason | null {
  if (item.kind !== 'ok') {
    return { kind: 'use-not-approval', id: item.id, itemKind: item.kind };
  }

  return item.extra.use === 'once' ? null : { kind: 'use-standing', id: item.id };
}
