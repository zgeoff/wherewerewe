import type { Extra, Item, Kind, RefusalReason } from '../types.ts';
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

export interface ApprovalLine {
  readonly id: string;
  readonly quote: string;
  readonly scope: string;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;

  // the age of a one-time approval, such as 5d; null for a standing one
  readonly age: string | null;
}

// What an upgrade or an import checks before it writes.
export type UpgradeProblem =
  | { readonly kind: 'needs-grant'; readonly approvals: readonly ApprovalLine[] }
  | { readonly kind: 'too-many-once'; readonly approvals: readonly ApprovalLine[] }
  | { readonly kind: 'grant-id' }
  | { readonly kind: 'grant-needs-part' }
  | { readonly kind: 'grant-text'; readonly reason: RefusalReason }
  | {
      readonly kind: 'drop-unknown';
      readonly id: string;
      readonly open: readonly string[];
    };
