import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedDayNineRows } from './seed-day-nine-rows.ts';

function setupTest() {
  return { seedDayNineRows };
}

test('it leaves out the rows the examples of commands.md write, and keeps pr-app-61 open, for the example start', async () => {
  const ctx = setupTest();

  const store = await ctx.seedDayNineRows(createTempDir('day-nine-rows').path, true);
  const read = await readStore(join(store.stateRoot, 'tide-alerts'));

  expect(
    read.kind === 'store' && [
      read.store.items.map((item) => item.id).filter((id) => id === 't-e2e' || id === 't-flag'),
      read.store.items.find((item) => item.id === 'pr-app-61')?.last,
      read.store.lessons.map((row) => row.id),
      read.store.promises.map((row) => row.id),
      read.store.words.map((row) => row.id),
    ],
  ).toStrictEqual([[], 'OPEN passing', [], [], ['w-small-prs']]);
});

test('it writes every row of day 9 when it is not the example start', async () => {
  const ctx = setupTest();

  const store = await ctx.seedDayNineRows(createTempDir('day-nine-rows').path, false);
  const read = await readStore(join(store.stateRoot, 'tide-alerts'));

  expect(
    read.kind === 'store' && [
      read.store.items.find((item) => item.id === 'pr-app-61')?.last,
      read.store.lessons.map((row) => row.id),
      read.store.promises.map((row) => row.id),
      read.store.words.map((row) => row.id),
    ],
  ).toStrictEqual(['MERGED', ['l-seed'], ['due-cost'], ['w-plain', 'w-small-prs']]);
});
