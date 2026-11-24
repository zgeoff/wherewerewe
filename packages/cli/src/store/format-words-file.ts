import type { WordsRow } from '../types.ts';
import { wordsHeader } from './constants.ts';

export function formatWordsFile(words: readonly WordsRow[]): string {
  const rows = words.map((row) => [row.id, row.words, row.where, row.written, row.by].join('\t'));

  return `${[wordsHeader, ...rows].join('\n')}\n`;
}
