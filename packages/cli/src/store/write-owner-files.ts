import { join } from 'node:path';
import type { OwnerChange } from '../types.ts';
import { createOwnerFiles } from './create-owner-files.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatOwnerFile } from './format-owner-file.ts';
import type { OwnerFiles } from './types.ts';

// The only writer of owner.tsv, called only by say and ack, inside the store lock. The journal goes
// first, as in writeStoreFiles: a say that stops after the append uses up its number, and an ack
// that stops leaves the note showing with its ack recorded.
export function writeOwnerFiles(
  folder: string,
  change: OwnerChange,
  files: OwnerFiles = createOwnerFiles(),
): void {
  files.append(join(folder, 'journal.tsv'), formatJournalRows(change.journal));

  const ownerPath = join(folder, 'owner.tsv');
  const temporaryPath = files.writeTemporary(ownerPath, formatOwnerFile(change.notes));

  files.rename(temporaryPath, ownerPath);
}
