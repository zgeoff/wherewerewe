import type { RefusalReason } from '../types.ts';
import type { WriteInput } from './types.ts';

// The refusal for an --on that names neither an open item nor a closed id in the journal.
export function pickOnRefusal(input: WriteInput, on: string | undefined): RefusalReason | null {
  if (on === undefined) {
    return null;
  }

  const openIDs = input.store.items.map((item) => item.id);

  return openIDs.includes(on) || input.journal.closed.has(on)
    ? null
    : { kind: 'on-unknown', args: input.args, id: on, openIDs };
}
