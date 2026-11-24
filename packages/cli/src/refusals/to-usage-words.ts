import type { RunWord } from '../types.ts';
import { toPlaceholder } from './to-placeholder.ts';

// The required words of a help line after `www`, such as `wait <id> "<what>" --who <who> [<check>]`:
// each bracketed group is left out, a quoted or bare `<placeholder>` becomes a placeholder, `<id>`
// and `<name>` with the id shape, and a `<n>` inside a word, as in `o-<n>`, becomes 1.
export function toUsageWords(line: string): RunWord[] {
  const words: RunWord[] = [];
  let depth = 0;

  for (const word of line.match(/"[^"]*"|\S+/gu) ?? []) {
    const opens = /^\[*/u.exec(word)?.[0].length ?? 0;
    const closes = /\]*$/u.exec(word.slice(opens))?.[0].length ?? 0;

    if (depth === 0 && opens === 0) {
      words.push(toUsageWord(word));
    }

    depth += opens - closes;
  }

  return words;
}

function toUsageWord(word: string): RunWord {
  const placeholder = /^"?(?<text><[^>]*>)"?$/u.exec(word)?.groups?.['text'];

  if (placeholder === undefined) {
    return word.replaceAll('<n>', '1');
  }

  return placeholder === '<id>' || placeholder === '<name>'
    ? toPlaceholder(placeholder, 'id')
    : toPlaceholder(placeholder);
}
