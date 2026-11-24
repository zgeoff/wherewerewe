import { match } from 'ts-pattern';
import { readStore } from '../store/read-store.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { Item } from '../types.ts';

// Adds open items to a session folder through the store module, in one read and one write, so a
// store of many items costs one fsync, not one for each. The fields a test leaves out read as an
// unchecked task written on 2026-03-10.
export async function seedItems(
  folder: string,
  items: readonly (Partial<Item> & { id: string })[],
): Promise<void> {
  const read = await readStore(folder);

  const store = match(read)
    .with({ kind: 'store' }, (found) => found.store)
    .with(
      { kind: 'missing' },
      { kind: 'hand-kept' },
      { kind: 'format-1' },
      { kind: 'newer' },
      { kind: 'broken' },
      () => {
        throw new Error(`no store to seed in ${folder}`);
      },
    )
    .exhaustive();

  const added = items.map((fields): Item => ({
    kind: 'task',
    claim: 'Write the parser',
    check: null,
    atWrite: null,
    last: null,
    written: '2026-03-10T10:31:09Z',
    by: 'agent',
    extra: {},
    ...fields,
  }));

  await writeStoreFiles(folder, { items: [...store.items, ...added], journal: [] });
}
