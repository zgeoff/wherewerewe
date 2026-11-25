import type { Store } from '../types.ts';
import type { BriefInput } from './types.ts';

export interface BriefContext {
  readonly nowMs: number;

  // the `--session` name as typed
  readonly sessionFlag: string | null;
  readonly host: 'claude' | 'codex' | null;

  // the decisions in force, newest first
  readonly decisions: BriefInput['decisions'];
}

// The part of the brief input that a read and a reply share, from the store alone.
export function buildBaseBriefInput(
  store: Store,
  context: BriefContext,
): Pick<
  BriefInput,
  | 'session'
  | 'items'
  | 'notes'
  | 'ownerNotes'
  | 'words'
  | 'pin'
  | 'promises'
  | 'lessons'
  | 'decisions'
  | 'nowMs'
  | 'sessionFlag'
  | 'host'
> {
  return {
    session: store.session,
    items: store.items,
    notes: store.notes,
    ownerNotes: store.ownerNotes,
    words: store.words,
    pin: store.pin,
    promises: store.promises,
    lessons: store.lessons,
    decisions: context.decisions,
    nowMs: context.nowMs,
    sessionFlag: context.sessionFlag,
    host: context.host,
  };
}
