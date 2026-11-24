import type { Item, LessonRow, Note, PromiseRow, SessionFile, WordsRow } from '../types.ts';
import type { CutRank } from './cut-ranks.ts';

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
  readonly words: readonly WordsRow[];
  readonly promises: readonly PromiseRow[];
  readonly lessons: readonly LessonRow[];

  // the decisions in force, newest first
  readonly decisions: readonly { readonly id: string; readonly choice: string }[];
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

  // the agent that reads the brief, which sets its size limit
  readonly host: 'claude' | 'codex' | null;
}

// What a section's cut line lists: the argument of `www list`.
export type CutKind =
  | 'waits'
  | 'approvals'
  | 'rules'
  | 'where'
  | 'lessons'
  | 'promises'
  | 'words'
  | 'decisions';

export interface ItemLine {
  readonly text: string;

  // the item the row shows, null for a row of no item
  readonly id: string | null;

  // the rank at which the cut drops the row; null for a row the cut never takes
  readonly rank: CutRank | null;
}

export interface ItemSection {
  readonly heading: string;

  // every row the section holds, in print order, before any cut
  readonly lines: readonly ItemLine[];

  // the section's own count line, given the rows that are kept
  readonly count: (keptRows: number) => string | null;

  // the kind its cut line names, null for a section that ends with its count line alone
  readonly cutKind: CutKind | null;

  // a line after the count line, printed while a row is kept
  readonly after: string | null;

  // true for a section that prints before CHANGED SINCE WRITTEN
  readonly isEarly: boolean;
}
