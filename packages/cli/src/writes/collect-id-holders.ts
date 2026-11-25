import { getKindWord } from '../rules/get-kind-word.ts';
import type { FileKind, Kind, Store } from '../types.ts';

export interface IDHolder {
  readonly kind: Kind | FileKind;

  // the file that holds the open row
  readonly file: 'items.tsv' | 'lessons.tsv' | 'promises.tsv' | 'words.tsv';
}

// Each of the four files that holds an open row with the id, in the order items.tsv, lessons.tsv,
// promises.tsv, words.tsv. A store the tool wrote holds at most one.
export function collectIDHolders(store: Store, id: string): IDHolder[] {
  return [
    ...store.items
      .filter((item) => item.id === id)
      .map((item): IDHolder => ({ kind: item.kind, file: 'items.tsv' })),
    ...store.lessons
      .filter((row) => row.id === id)
      .map((): IDHolder => ({ kind: 'lesson', file: 'lessons.tsv' })),
    ...store.promises
      .filter((row) => row.id === id)
      .map((): IDHolder => ({ kind: 'promise', file: 'promises.tsv' })),
    ...store.words
      .filter((row) => row.id === id)
      .map((): IDHolder => ({ kind: 'words', file: 'words.tsv' })),
  ];
}

// The ids of every open row of the four files, which a refusal lists as the open items.
export function collectOpenIDs(store: Store): string[] {
  return [
    ...store.items.map((item) => item.id),
    ...store.lessons.map((row) => row.id),
    ...store.promises.map((row) => row.id),
    ...store.words.map((row) => row.id),
  ];
}

// `a task in items.tsv`, `the owner's words in words.tsv`.
export function formatIDHolder(holder: IDHolder): string {
  return holder.kind === 'words'
    ? `the owner's words in ${holder.file}`
    : `a ${getKindWord(holder.kind)} in ${holder.file}`;
}
