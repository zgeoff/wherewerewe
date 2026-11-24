import type { Grant } from '../types.ts';

export type GrantWords = Pick<Grant, 'may' | 'not' | 'never' | 'scope'>;

// The owner's words in a grant, in code points: every bullet and the scope.
export function countGrantWords(words: GrantWords): number {
  return [...words.may, ...words.not, ...words.never, words.scope ?? ''].reduce(
    (total, text) => total + Array.from(text, (character) => character).length,
    0,
  );
}
