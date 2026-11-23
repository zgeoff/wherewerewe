// Splits a `Run: www ...` line into the arguments after `www`. A double-quoted word stays whole,
// with its escapes undone, and so does a `<placeholder>`, which may hold spaces. It throws on a
// line that is not a www line.
export function parseRunLine(line: string): readonly string[] {
  const prefix = 'Run: www ';

  if (!line.startsWith(prefix) && line !== 'Run: www') {
    throw new Error(`not a www run line: ${line}`);
  }

  const text = line.slice(prefix.length - 1);
  const words: string[] = [];
  let word: string | null = null;
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (char === ' ' && word !== null) {
      words.push(word);

      word = null;
      index += 1;
    } else if (char === ' ') {
      index += 1;
    } else if (char === '"') {
      const end = getQuoteEnd(text, index + 1);

      word =
        (word ?? '') +
        text.slice(index + 1, end).replaceAll(/\\(?<escaped>["\\$`])/gu, '$<escaped>');

      index = end + 1;
    } else if (char === '<') {
      const end = text.indexOf('>', index);

      word = (word ?? '') + text.slice(index, end + 1);
      index = end + 1;
    } else {
      word = (word ?? '') + char;
      index += 1;
    }
  }

  return word === null ? words : [...words, word];
}

function getQuoteEnd(text: string, start: number): number {
  let index = start;

  while (index < text.length && text.charAt(index) !== '"') {
    index += text.charAt(index) === '\\' ? 2 : 1;
  }

  return index;
}
