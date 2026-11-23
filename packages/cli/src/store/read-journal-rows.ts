import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JournalRow } from '../types.ts';
import { parseJournalFile } from './parse-journal-file.ts';

// Every row of the journal, oldest first. Only the reads that show history call it: a write reads
// the journal index instead. A session with no journal file has no rows.
export async function readJournalRows(folder: string): Promise<JournalRow[]> {
  try {
    const text = await readFile(join(folder, 'journal.tsv'), 'utf8');

    return parseJournalFile(text);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}
