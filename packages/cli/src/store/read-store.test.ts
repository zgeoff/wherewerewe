import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { readStore } from './read-store.ts';

function setupTest() {
  const root = createTempDir('read-store').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it reads the session and its items', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [expect.objectContaining({ id: 't-a', claim: 'Write it' })],
    },
  });
});

test('it reports a folder with no session file as missing', async () => {
  const ctx = setupTest();

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({ kind: 'missing' });
});

test.each([
  ['a hand-kept session', 'name=a\ngoal=b\nstarted=c\n', { kind: 'hand-kept' }],
  ['a newer format', 'format=2\n', { kind: 'newer', format: '2' }],
  [
    'a broken session',
    'format=1\ncolour=red\n',
    { kind: 'broken', file: 'session', line: null, reason: 'the key colour is not in format 1' },
  ],
])('it reports %s without reading the items', async (_title, text, expected) => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', text);

  const read = await readStore(ctx.folder);

  expect<unknown>(read).toStrictEqual(expected);
});

test('it reports a broken items file with its line', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n',
  );

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'broken',
    file: 'items.tsv',
    line: 2,
    reason: 'expected 9 tab-separated columns, found 2',
  });
});
