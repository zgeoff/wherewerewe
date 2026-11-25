import { join } from 'node:path';
import type { CheckSave } from '../checks/pick-check-save.ts';
import { formatItemsFile } from './format-items-file.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatPrsFile } from './format-prs-file.ts';
import { writeAppendNoFollowAsync } from './write-append-no-follow.ts';
import { writeFileAtomic } from './write-file-atomic.ts';

// Runs only inside the lock, to save what a read found. The journal goes first, then items.tsv,
// then prs.tsv. It never opens session, notes.tsv or owner.tsv.
export async function writeCheckFiles(folder: string, save: CheckSave): Promise<void> {
  if (save.journal.length > 0) {
    await writeAppendNoFollowAsync(join(folder, 'journal.tsv'), formatJournalRows(save.journal));
  }

  if (save.items !== null) {
    writeFileAtomic(join(folder, 'items.tsv'), formatItemsFile(save.items));
  }

  if (save.prs !== null) {
    writeFileAtomic(join(folder, 'prs.tsv'), formatPrsFile(save.prs));
  }
}
