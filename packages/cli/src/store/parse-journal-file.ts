import type { JournalRow } from '../types.ts';
import { parseJournalLine } from './parse-journal-line.ts';

// Drops a last line with no newline, so a read that races an append never sees half a row.
export function parseJournalFile(text: string): JournalRow[] {
  return text
    .split('\n')
    .slice(0, -1)
    .flatMap((line) => {
      const row = parseJournalLine(line);

      return row === null ? [] : [row];
    });
}
