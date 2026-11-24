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

  // this read's result for each item and pull request ref; empty when no probe ran
  readonly results: ReadonlyMap<string, string>;

  // why the item in focus shows no next step
  readonly nowHidden:
    | { readonly kind: 'changed' }
    | { readonly kind: 'reads'; readonly result: string }
    | null;
  readonly nowMs: number;

  // the `--session` name as typed, for the command the count line prints
  readonly sessionFlag: string | null;

  // the agent that reads the brief, which sets its size budget
  readonly host: 'claude' | 'codex' | null;
}

export interface ItemLine {
  readonly text: string;

  // the item the row shows, null for a pull request row
  readonly id: string | null;
}

export interface ItemSection {
  readonly heading: string;
  readonly lines: readonly ItemLine[];

  // a line after the rows that the cut never takes
  readonly tail: string | null;
}

// The brief's size limit for the agent that reads it.
export interface BriefBudget {
  readonly maxLines: number;
  readonly maxCharacters: number;

  // the task rows the budget's worst case holds with no count line
  readonly taskRows: number;
}
