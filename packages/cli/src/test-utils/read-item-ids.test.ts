import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readItemIDs } from './read-item-ids.ts';
import { seedItem } from './seed-item.ts';
import { seedSessionStore } from './seed-session-store.ts';
import { seedStoreFile } from './seed-store-file.ts';

function setupTest() {
  const root = createTempDir('read-item-ids').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it lists the ids of the open items in order', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-b' });
  await seedItem(ctx.folder, { id: 't-a' });

  expect(readItemIDs(ctx.folder)).toStrictEqual(['t-a', 't-b']);
});

test('it lists no ids for a file that does not parse', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'items.tsv', 'not the header\n');

  expect(readItemIDs(ctx.folder)).toStrictEqual([]);
});
