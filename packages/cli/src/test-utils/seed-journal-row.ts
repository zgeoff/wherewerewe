import { writeStoreFiles } from '../store/write-store-files.ts';

interface JournalSeed {
  readonly ts: string;
  readonly op: string;
  readonly id: string;
}

// Appends a journal row to a session folder through the store module.
export async function seedJournalRow(folder: string, row: JournalSeed): Promise<void> {
  await writeStoreFiles(folder, {
    journal: [{ ...row, by: 'agent', text: 'a claim', why: 'a reason', extra: null }],
  });
}
