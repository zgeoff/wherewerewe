import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import type { JournalRow } from '../types.ts';
import { parseJournalLine } from './parse-journal-line.ts';

export async function readJournalRows(
  folder: string,
  keep: (row: JournalRow) => boolean,
): Promise<JournalRow[]> {
  const rows: JournalRow[] = [];
  let pending = '';

  try {
    for await (const chunk of createReadStream(join(folder, 'journal.tsv'), 'utf8')) {
      const lines = `${pending}${String(chunk)}`.split('\n');

      pending = lines.pop() ?? '';

      for (const line of lines) {
        const row = parseJournalLine(line);

        if (row !== null && keep(row)) {
          rows.push(row);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return rows;
}
