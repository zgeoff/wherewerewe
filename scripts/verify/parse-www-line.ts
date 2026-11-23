import { WringerError } from '@wringer/core';

// Splits a `www ...` command line from a journey into the words after `www`. A double-quoted word
// keeps its spaces, with \", \\, \$ and \` as escapes. It fails with `usage` on an open quote or a
// line that does not start with `www`.
export function parseWWWLine(line: string): readonly string[] {
  const words: string[] = [];
  let word: string | null = null;
  let isQuoted = false;
  let index = 0;

  while (index < line.length) {
    const char = line.charAt(index);
    const next = line.charAt(index + 1);

    if (isQuoted && char === '\\' && '"\\$`'.includes(next) && next !== '') {
      word = (word ?? '') + next;
      index += 2;
    } else if (char === '"') {
      isQuoted = !isQuoted;
      word ??= '';
      index += 1;
    } else if (char === ' ' && !isQuoted) {
      if (word !== null) {
        words.push(word);
      }

      word = null;
      index += 1;
    } else {
      word = (word ?? '') + char;
      index += 1;
    }
  }

  if (isQuoted) {
    throw new WringerError('usage', { message: `The line has an open quote: ${line}` });
  }

  const all = word === null ? words : [...words, word];

  if (all[0] !== 'www') {
    throw new WringerError('usage', { message: `The line must start with www: ${line}` });
  }

  return all.slice(1);
}
