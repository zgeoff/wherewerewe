import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isItemID } from '../rules/is-item-id.ts';
import type { RefusalReason } from '../types.ts';
import { pickOnRefusal } from './pick-on-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { OwnerWriteResult, WriteInput } from './types.ts';

const noteCap = 2;

export function pickSay(input: WriteInput): OwnerWriteResult {
  const store = input.store;
  const args = input.args;
  const text = args.positionals[0] ?? '';
  const on = args.values.on;

  const reason =
    pickTextRefusal(
      args,
      [{ target: { label: 'owner note', place: { positional: 0 } }, text, limit: 160 }],
      false,
    ) ?? pickSayOnRefusal(input, on);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const [oldest] = store.ownerNotes;

  if (store.ownerNotes.length >= noteCap && oldest !== undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'owner-notes-full',
        name: store.session.name,
        oldestID: oldest.id,
      }),
    };
  }

  const highestShown = Math.max(
    0,
    ...store.ownerNotes.map((note) => Number(note.id.slice('o-'.length))),
  );

  const lastNumber = Math.max(input.journal.lastOwnerNoteNumber, highestShown);

  // The journal index skips an id past the safe integers, so it could never count past one.
  if (lastNumber >= Number.MAX_SAFE_INTEGER) {
    return {
      kind: 'refused',
      refusal: buildRefusal({ kind: 'owner-note-numbers-used-up', lastNumber }),
    };
  }

  const id = `o-${String(lastNumber + 1)}`;
  const said = formatTimestamp(input.nowMs);

  return {
    kind: 'write',
    change: {
      notes: [...store.ownerNotes, { id, text, said, on: on ?? null }],
      journal: [
        {
          ts: said,
          op: 'say',
          id,
          by: 'owner',
          text,
          why: null,
          extra: on === undefined ? null : `on=${on}`,
        },
      ],
    },
    reply: (briefLines) =>
      `${id}  owner note${on === undefined ? '' : ` on ${on}`}. It tops the brief until you run: www --session ${store.session.name} ack ${id}. Brief: ${String(briefLines)} lines.`,
  };
}

// owner.tsv holds an item id or nothing in its on column, so a closed id the journal knows, such as
// d-1, is refused here though decide takes it.
function pickSayOnRefusal(input: WriteInput, on: string | undefined): RefusalReason | null {
  return on !== undefined && !isItemID(on)
    ? {
        kind: 'on-unknown',
        args: input.args,
        id: on,
        openIDs: input.store.items.map((item) => item.id),
      }
    : pickOnRefusal(input, on);
}
