import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { JournalRow, SessionFile } from '../types.ts';
import { itemsHeader, journalHeader, ownerHeader, prsHeader } from './constants.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatSessionFile } from './format-session-file.ts';
import { withStoreLock } from './with-store-lock.ts';
import { writeFileAtomic } from './write-file-atomic.ts';

// Makes the session folder without `recursive`, so of two inits of one name only one wins.
export async function createSessionStore(
  root: string,
  session: SessionFile,
  journal: readonly JournalRow[],
): Promise<'created' | 'exists'> {
  mkdirSync(root, { recursive: true });

  const folder = join(root, session.name);

  try {
    mkdirSync(folder);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return 'exists';
    }

    throw error;
  }

  const locked = await withStoreLock(folder, () => {
    writeFileAtomic(join(folder, 'items.tsv'), `${itemsHeader}\n`);
    writeFileAtomic(join(folder, 'owner.tsv'), `${ownerHeader}\n`);
    writeFileAtomic(join(folder, 'prs.tsv'), `${prsHeader}\n`);
    writeFileAtomic(join(folder, 'journal.tsv'), `${journalHeader}\n${formatJournalRows(journal)}`);
    writeFileAtomic(join(folder, 'session'), formatSessionFile(session));

    return Promise.resolve();
  });

  return locked.kind === 'ran' ? 'created' : 'exists';
}
