import type {
  JournalIndex,
  OwnerChange,
  ParsedArgs,
  Refusal,
  Store,
  StoreChange,
} from '../types.ts';

export interface WriteInput {
  readonly store: Store;
  readonly journal: JournalIndex;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly nowMs: number;
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
