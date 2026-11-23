import type { Item, Kind } from '../types.ts';
import type { HandKeptRow } from './parse-hand-kept-store.ts';

export interface JournalFact {
  readonly line: number;
  readonly ts: string;
  readonly op: string;
  readonly id: string;
  readonly text: string;
  readonly hasCarriageReturn: boolean;
  readonly closedText: string | null;
}

export interface Facts {
  readonly journal: readonly JournalFact[];
  readonly settledIDs: ReadonlySet<string>;
  readonly itemRows: readonly HandKeptRow[];
  readonly questions: readonly Question[];
  readonly reopened: readonly Question[];
}

export interface Question {
  readonly line: number;
  readonly id: string;
  readonly text: string;
  readonly ts: string;
  readonly closedLine: number | null;
}

export interface ItemChecks {
  readonly items: readonly Item[];
  readonly problems: readonly string[];
  readonly openKinds: ReadonlyMap<string, Kind>;
  readonly openIDs: ReadonlyMap<string, number>;
}
