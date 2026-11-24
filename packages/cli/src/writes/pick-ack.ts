import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatBriefLine } from './format-brief-line.ts';
import type { OwnerWriteResult, WriteInput } from './types.ts';

export function pickAck(input: WriteInput): OwnerWriteResult {
  const store = input.store;
  const id = input.args.positionals[0] ?? '';
  const note = store.ownerNotes.find((shown) => shown.id === id);

  if (note === undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'owner-note-unknown',
        name: store.session.name,
        id,
        shownIDs: store.ownerNotes.map((shown) => shown.id),
      }),
    };
  }

  return {
    kind: 'write',
    change: {
      notes: store.ownerNotes.filter((shown) => shown.id !== id),
      journal: [
        {
          ts: formatTimestamp(input.nowMs),
          op: 'ack',
          id,
          by: 'owner',
          text: note.text,
          why: null,
          extra: null,
        },
      ],
    },
    reply: (figure) => `${id}  cleared. Kept in the journal. ${formatBriefLine(figure)}`,
  };
}
