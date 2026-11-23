import { readStore } from '../store/read-store.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { Item } from '../types.ts';

// Adds an open item to a session folder through the store module. The fields the test leaves out
// read as an unchecked task written on 2026-03-10.
export async function seedItem(
  folder: string,
  fields: Partial<Item> & { id: string },
): Promise<void> {
  const read = await readStore(folder);

  if (read.kind !== 'store') {
    throw new Error(`no store to seed in ${folder}`);
  }

  const item: Item = {
    kind: 'task',
    claim: 'Write the parser',
    check: null,
    atWrite: null,
    last: null,
    written: '2026-03-10T10:31:09Z',
    by: 'agent',
    extra: {},
    ...fields,
  };

  await writeStoreFiles(folder, { items: [...read.store.items, item], journal: [] });
}
