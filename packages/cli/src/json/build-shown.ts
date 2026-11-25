import type { Item, LessonRow, Note, PromiseRow, WordsRow } from '../types.ts';
import type { Shown } from './types.ts';

export type ShownSource =
  | { readonly item: Item; readonly notes: readonly Note[] }
  | { readonly lesson: LessonRow }
  | { readonly promise: PromiseRow }
  | { readonly words: WordsRow };

// An open row as `Shown` holds it. An item carries its note, or null when it has none.
export function buildShown(source: ShownSource): Shown {
  if ('item' in source) {
    const item = source.item;

    return {
      kind: item.kind,
      row: item,
      note: source.notes.find((note) => note.id === item.id) ?? null,
    };
  }

  if ('lesson' in source) {
    return { kind: 'lesson', row: source.lesson, note: null };
  }

  if ('promise' in source) {
    return { kind: 'promise', row: source.promise, note: null };
  }

  return { kind: 'words', row: source.words, note: null };
}
