import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedJsonCellsStore } from './seed-json-cells-store.ts';

function setupTest() {
  const root = createTempDir('seed-json-cells-store').path;

  return {
    root,
    seed: seedJsonCellsStore,
    readStore: (name: string) => readStore(join(root, 'wherewerewe', name)),
  };
}

test('it makes a store that reads whole, with a row of each kind', async () => {
  const ctx = setupTest();

  ctx.seed(ctx.root, {});

  const read = await ctx.readStore('tide-alerts');

  const kinds = read.kind === 'store' ? read.store.items.map((item) => item.kind) : read.kind;

  expect(kinds).toStrictEqual(['task', 'task', 'wait', 'wait', 'ok', 'rule', 'where']);
});

test('it puts the cell a test gives over the plain one, and names the session for its cell', async () => {
  const ctx = setupTest();

  ctx.seed(ctx.root, { 'task claim': 'A claim of its own', 'session name': 'other-name' });

  const read = await ctx.readStore('other-name');

  const found =
    read.kind === 'store' ? [read.store.session.name, read.store.items[0]?.claim] : read.kind;

  expect(found).toStrictEqual(['other-name', 'A claim of its own']);
});
