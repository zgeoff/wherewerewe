import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import type { StoreChange } from '../types.ts';
import { formatItemsFile } from './format-items-file.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatLessonsFile } from './format-lessons-file.ts';
import { formatNotesFile } from './format-notes-file.ts';
import { formatPromisesFile } from './format-promises-file.ts';
import { formatSessionFile } from './format-session-file.ts';
import { formatWordsFile } from './format-words-file.ts';
import { writeAppendNoFollowAsync } from './write-append-no-follow.ts';
import { writeFileAtomic } from './write-file-atomic.ts';

// Runs only inside the lock. The journal goes first, then the files, so a write that stops half way
// leaves a close recorded with its row still open, never a row gone with no record, which would
// free its id. The lessons, promises and words files are written only when the change holds them.
export async function writeStoreFiles(folder: string, change: StoreChange): Promise<void> {
  if (change.journal.length > 0) {
    const path = join(folder, 'journal.tsv');

    await writeAppendNoFollowAsync(
      path,
      `${readCutLineEnd(path)}${formatJournalRows(change.journal)}`,
    );
  }

  if (change.items !== undefined) {
    writeFileAtomic(join(folder, 'items.tsv'), formatItemsFile(change.items));
  }

  if (change.notes !== undefined) {
    writeFileAtomic(join(folder, 'notes.tsv'), formatNotesFile(change.notes));
  }

  if (change.lessons !== undefined) {
    writeFileAtomic(join(folder, 'lessons.tsv'), formatLessonsFile(change.lessons));
  }

  if (change.promises !== undefined) {
    writeFileAtomic(join(folder, 'promises.tsv'), formatPromisesFile(change.promises));
  }

  if (change.words !== undefined) {
    writeFileAtomic(join(folder, 'words.tsv'), formatWordsFile(change.words));
  }

  if (change.session !== undefined) {
    writeFileAtomic(join(folder, 'session'), formatSessionFile(change.session));
  }
}

// A line break when the journal ends inside a row that a stopped append cut short, so the next row
// starts a line of its own and the cut row stays one line that no read takes as a row.
function readCutLineEnd(path: string): string {
  let handle: number;

  try {
    handle = openSync(path, 'r');
  } catch {
    return '';
  }

  try {
    const size = fstatSync(handle).size;
    const last = Buffer.alloc(1);

    return size > 0 && readSync(handle, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a ? '\n' : '';
  } finally {
    closeSync(handle);
  }
}
