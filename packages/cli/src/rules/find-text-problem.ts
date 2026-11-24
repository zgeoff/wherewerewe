import { lineBreakPattern } from './line-break-pattern.ts';

export type TextProblem =
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-one-line' }
  | { readonly kind: 'too-long'; readonly length: number };

// A lone `-` is the empty cell on disk, so the journal could not tell it from no text: it counts
// as empty. A tab or any line break, a Unicode line or paragraph separator among them, is refused.
export function findTextProblem(text: string, limit: number): TextProblem | null {
  if (text === '' || text === '-') {
    return { kind: 'empty' };
  }

  if (lineBreakPattern.test(text)) {
    return { kind: 'not-one-line' };
  }

  const length = Array.from(text, (character) => character).length;

  return length > limit ? { kind: 'too-long', length } : null;
}
