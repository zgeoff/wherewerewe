import type { Extra, Item, Kind } from '../types.ts';
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
  readonly items: readonly Format1Item[];
  readonly problems: readonly string[];
  readonly openKinds: ReadonlyMap<string, Kind>;
  readonly openIDs: ReadonlyMap<string, number>;
}

export interface Format1Extra extends Extra {
  readonly use?: 'once' | 'standing';
}

export interface Format1Item extends Omit<Item, 'extra'> {
  readonly extra: Format1Extra;
}

export interface Format1Session {
  readonly format: '1';
  readonly name: string;
  readonly goal: string;
  readonly started: string;
  readonly now: string | null;
  readonly nowNext: string | null;
  readonly nowSet: string | null;
  readonly lastWrite: string | null;
  readonly lastNudge: string | null;
  readonly importedFrom: string | null;
}
