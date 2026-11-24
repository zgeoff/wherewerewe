import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedExampleStartStore } from './seed-example-start-store.ts';

function setupTest() {
  return { seedExampleStartStore };
}

test('it seeds the day-9 store without t-flag and the lesson, promise and words the examples write', async () => {
  const ctx = setupTest();

  const store = await ctx.seedExampleStartStore(createTempDir('example-start').path);
  const read = await readStore(join(store.stateRoot, 'tide-alerts'));

  expect(
    read.kind === 'store' && [
      read.store.items.some((item) => item.id === 't-flag'),
      read.store.lessons.length,
      read.store.promises.length,
      read.store.words.map((row) => row.id),
    ],
  ).toStrictEqual([false, 0, 0, ['w-small-prs']]);
});
