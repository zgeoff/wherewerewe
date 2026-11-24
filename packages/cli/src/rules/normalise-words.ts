// Each line break of the owner's words becomes one space, so a statement that spans lines is one
// line in the store.
export function normaliseWords(words: string): string {
  return words.replaceAll(/\r\n|\r|\n/gu, ' ');
}
