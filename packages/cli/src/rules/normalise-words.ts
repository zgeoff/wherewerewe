// Each line break of the owner's words, a Unicode line or paragraph separator too, becomes one
// space, so a statement that spans lines is one line in the store.
export function normaliseWords(words: string): string {
  return words.replaceAll(/\r\n|[\n\v\f\r\u0085\u2028\u2029]/gu, ' ');
}
