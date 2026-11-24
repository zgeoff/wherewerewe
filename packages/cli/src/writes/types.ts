import type {
  JournalIndex,
  OwnerChange,
  ParsedArgs,
  Refusal,
  Store,
  StoreChange,
} from '../types.ts';

// What a write's probe found before the lock, for the check the write expected to store.
export interface WriteProbe {
  readonly ref: string;

  // `unchecked` stores no result
  readonly result: string;

  // the process start time of a pid check, null when none could be read
  readonly pidStart: string | null;
}

export interface WriteInput {
  readonly store: Store;
  readonly journal: JournalIndex;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly nowMs: number;

  // null for a write with no check
  readonly probed: WriteProbe | null;
}

export type WriteResult =
  | {
      readonly kind: 'write';
      readonly change: StoreChange;
      readonly reply: (briefLines: number) => string;
    }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

export type OwnerWriteResult =
  | {
      readonly kind: 'write';
      readonly change: OwnerChange;
      readonly reply: (briefLines: number) => string;
    }
  | { readonly kind: 'refused'; readonly refusal: Refusal };
