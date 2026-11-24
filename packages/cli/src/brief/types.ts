import type { Item, Note, SessionFile } from '../types.ts';

export interface BriefInput {
  readonly session: SessionFile;
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly ownerNotes: readonly {
    readonly id: string;
    readonly text: string;
    readonly said: string;
    readonly on: string | null;
  }[];
  readonly changed: readonly { readonly item: Item; readonly result: string }[];
  readonly pullRequests: readonly {
    readonly ref: string;
    readonly opened: string;
    readonly result: string;
  }[];
  readonly checks:
    | { readonly kind: 'none' }
    | { readonly kind: 'not-run'; readonly count: number }
    | {
        readonly kind: 'ran';
        readonly count: number;
        readonly seconds: number;
        readonly unchecked: { readonly count: number; readonly reason: string } | null;
      };
  readonly resultsNotSaved: 'not-writable' | 'lock-held' | null;
  readonly nowMs: number;
}
