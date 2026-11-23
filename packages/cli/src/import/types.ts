import type { Item, Kind } from '../types.ts';
import type { HandKeptRow } from './parse-hand-kept-store.ts';

export interface JournalFact {
  readonly line: number;
  readonly ts: string;
  readonly op: string;
  readonly id: string;
  readonly text: string;
  readonly hasCarriageReturn: boolean;
}

export interface Facts {
  // the rows with 4 columns, in file order
  readonly journal: readonly JournalFact[];

  // ids that a done or closed row settles
  readonly settledIDs: ReadonlySet<string>;

  // the 9-column rows of items.tsv
  readonly itemRows: readonly HandKeptRow[];

  // id -> claim, of every 9-column row
  readonly claims: ReadonlyMap<string, string>;

  // the open rows that no later closed row settles
  readonly questions: readonly Question[];
}

export interface Question {
  readonly line: number;
  readonly id: string;
  readonly text: string;
  readonly ts: string;
}

export interface ItemChecks {
  readonly items: readonly Item[];
  readonly problems: readonly string[];

  readonly openKinds: ReadonlyMap<string, Kind>;
  readonly openIDs: ReadonlyMap<string, number>;
}
