import { getSessionDay } from '../brief/get-session-day.ts';
import type { FileKind, Kind, RefusalReason } from '../types.ts';
import { collectIDHolders } from './collect-id-holders.ts';
import type { WriteInput } from './types.ts';

// The refusal for a new row of `kind` with an id that is open as another kind, or closed in the
// journal and open nowhere. An id open as `kind` is a replace, whatever the journal holds.
export function pickKindIDRefusal(
  input: WriteInput,
  id: string,
  kind: Kind | FileKind,
): RefusalReason | null {
  const holders = collectIDHolders(input.store, id);
  const other = holders.find((holder) => holder.kind !== kind);

  if (other !== undefined) {
    return { kind: 'other-kind', args: input.args, id, itemKind: other.kind };
  }

  const closedTs = input.journal.closed.get(id);

  return holders.length === 0 && closedTs !== undefined
    ? {
        kind: 'closed-id',
        args: input.args,
        id,
        day: getSessionDay(input.store.session.started, Date.parse(closedTs)),
      }
    : null;
}
