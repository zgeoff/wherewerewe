import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreChange } from '../types.ts';
import { formatItemsFile } from './format-items-file.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatSessionFile } from './format-session-file.ts';
import { writeFileAtomic } from './write-file-atomic.ts';

// Runs only inside the lock. Writes items.tsv, then session, then appends the journal rows with
// one call. It never opens owner.tsv or prs.tsv.
export async function writeStoreFiles(folder: string, change: StoreChange): Promise<void> {
  if (change.items !== undefined) {
    writeFileAtomic(join(folder, 'items.tsv'), formatItemsFile(change.items));
  }

  if (change.session !== undefined) {
    writeFileAtomic(join(folder, 'session'), formatSessionFile(change.session));
  }

  if (change.journal.length > 0) {
    await appendFile(join(folder, 'journal.tsv'), formatJournalRows(change.journal));
  }
}
