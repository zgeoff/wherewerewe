export type TextProblem =
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-one-line' }
  | { readonly kind: 'too-long'; readonly length: number };

export function findTextProblem(text: string, limit: number): TextProblem | null {
  if (text === '') {
    return { kind: 'empty' };
  }

  if (/[\t\n\r]/u.test(text)) {
    return { kind: 'not-one-line' };
  }

  const length = [...text].length;

  return length > limit ? { kind: 'too-long', length } : null;
}
