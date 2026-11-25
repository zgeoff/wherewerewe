import { RefusalError } from '../refusal-error.ts';
import type { Args } from '../types.ts';

const valueFlags = new Set([
  '--note',
  '--id',
  '--who',
  '--why',
  '--evidence',
  '--session',
  '--goal',
]);

const switchFlags = new Set(['--human', '--all', '--switch', '--print', '--help', '--version']);

// Splits what the agent typed into plain words, flags with a value and flags without one.
export function parseArgs(argv: readonly string[]): Args {
  const words: string[] = [];
  const values: Record<string, string> = {};

  const switches = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index] ?? '';

    if (valueFlags.has(word)) {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new RefusalError(`${word} needs a value`, 'www help');
      }

      values[word.slice(2)] = value;
      index += 1;
    } else if (switchFlags.has(word)) {
      switches.add(word.slice(2));
    } else if (word.startsWith('--')) {
      throw new RefusalError(`there is no ${word} flag`, 'www help');
    } else {
      words.push(word);
    }
  }

  return { words, values, switches };
}
