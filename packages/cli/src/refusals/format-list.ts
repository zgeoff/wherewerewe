export function formatList(words: readonly string[]): string {
  return words.length === 0 ? 'none' : words.join(', ');
}
