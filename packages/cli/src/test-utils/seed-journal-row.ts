import { writeStoreFiles } from '../store/write-store-files.ts';
import type { JournalRow } from '../types.ts';

interface JournalSeed {
  readonly ts: string;
  readonly op: string;
  readonly id: string;
  readonly by?: JournalRow['by'];
  readonly extra?: string;
}

// Appends a journal row to a session folder through the store module.
export async function seedJournalRow(folder: string, row: JournalSeed): Promise<void> {
  await writeStoreFiles(folder, {
    journal: [
      {
        ts: row.ts,
        op: row.op,
        id: row.id,
        by: row.by ?? 'agent',
        text: 'a claim',
        why: 'a reason',
        extra: row.extra ?? null,
      },
    ],
  });
}
