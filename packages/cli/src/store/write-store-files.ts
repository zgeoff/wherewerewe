import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StoreChange } from '../types.ts';
import { formatItemsFile } from './format-items-file.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatNotesFile } from './format-notes-file.ts';
import { formatSessionFile } from './format-session-file.ts';
import { writeFileAtomic } from './write-file-atomic.ts';

// Runs only inside the lock. The journal goes first, then items.tsv, notes.tsv and session, so a write that stops half way leaves a close
// recorded with its item still open, never an item gone with no record, which would free its id.
// It never opens owner.tsv or prs.tsv.
export async function writeStoreFiles(folder: string, change: StoreChange): Promise<void> {
  if (change.journal.length > 0) {
    await appendFile(join(folder, 'journal.tsv'), formatJournalRows(change.journal));
  }

  if (change.items !== undefined) {
    writeFileAtomic(join(folder, 'items.tsv'), formatItemsFile(change.items));
  }

  if (change.notes !== undefined) {
    writeFileAtomic(join(folder, 'notes.tsv'), formatNotesFile(change.notes));
  }

  if (change.session !== undefined) {
    writeFileAtomic(join(folder, 'session'), formatSessionFile(change.session));
  }
}
