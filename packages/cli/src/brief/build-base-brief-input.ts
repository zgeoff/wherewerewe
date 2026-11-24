import type { Store } from '../types.ts';
import type { BriefInput } from './types.ts';

export interface BriefContext {
  readonly nowMs: number;

  // the `--session` name as typed
  readonly sessionFlag: string | null;
  readonly host: 'claude' | 'codex' | null;
}

// The part of the brief input that a read and a reply share, from the store alone.
export function buildBaseBriefInput(
  store: Store,
  context: BriefContext,
): Pick<
  BriefInput,
  'session' | 'items' | 'notes' | 'ownerNotes' | 'nowMs' | 'sessionFlag' | 'host'
> {
  return {
    session: store.session,
    items: store.items,
    notes: store.notes,
    ownerNotes: store.ownerNotes,
    nowMs: context.nowMs,
    sessionFlag: context.sessionFlag,
    host: context.host,
  };
}
