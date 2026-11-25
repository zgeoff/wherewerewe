// The word as a shell reads it back: the word itself when it holds only safe characters, otherwise
// inside single quotes.
export function quoteShellWord(word: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/u.test(word)) {
    return word;
  }

  return `'${word.replaceAll("'", String.raw`'\''`)}'`;
}
