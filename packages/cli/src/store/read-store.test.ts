import { expect, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
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
      ownerNotes: [],
      ownerUnread: null,
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
    {
      kind: 'broken',
      file: 'session',
      line: null,
      reason: 'the key colour is not in format 1',
      partial: null,
    },
  ],
])('it reports %s without reading the items', async (_title, text, expected) => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', text);

  const read = await readStore(ctx.folder);

  const actual: unknown = read;

  expect(actual).toStrictEqual(expected);
});

test('it reports a broken items file with its line, and the store as far as it reads', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    `${readFileSync(join(ctx.folder, 'items.tsv'), 'utf8')}t-b\ttask\n`,
  );

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'broken',
    file: 'items.tsv',
    line: 3,
    reason: 'expected 9 tab-separated columns, found 2',
    partial: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [expect.objectContaining({ id: 't-a' })],
      ownerNotes: [],
      ownerUnread: null,
    },
  });
});

test('it reports a missing items file with the session and no items', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  rmSync(join(ctx.folder, 'items.tsv'));

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'broken',
    file: 'items.tsv',
    line: null,
    reason: 'the file is missing',
    partial: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [],
      ownerNotes: [],
      ownerUnread: null,
    },
  });
});
