import { parseRunLine } from './parse-run-line.ts';

// The arguments of a usage Run line with each placeholder filled from `fills`. A bracketed optional
// group is left out unless its first word, with the bracket cut, is in `keeps`: then it stays,
// without its brackets. It throws on a placeholder with no fill.
export function buildUsageRunArgv(
  line: string,
  fills: Readonly<Record<string, string>>,
  keeps: readonly string[] = [],
): readonly string[] {
  const argv: string[] = [];
  let depth = 0;
  let droppedAt: number | null = null;

  for (const word of parseRunLine(line)) {
    const opens = /^\[*/u.exec(word)?.[0].length ?? 0;
    const closes = /\]*$/u.exec(word.slice(opens))?.[0].length ?? 0;
    const bare = word.slice(opens, word.length - closes);

    if (opens > 0 && droppedAt === null && !keeps.includes(bare)) {
      droppedAt = depth;
    }

    depth += opens;

    if (droppedAt === null) {
      argv.push(fillWord(bare, fills, line));
    }

    depth -= closes;

    if (droppedAt !== null && depth <= droppedAt) {
      droppedAt = null;
    }
  }

  return argv;
}

function fillWord(word: string, fills: Readonly<Record<string, string>>, line: string): string {
  const fill = fills[word];

  if (fill !== undefined) {
    return fill;
  }

  if (/<[^>]*>/u.test(word)) {
    throw new Error(`no fill for the placeholder ${word} in: ${line}`);
  }

  return word;
}
