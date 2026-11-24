import { expect, test } from 'bun:test';
import { buildStubHeldStat } from './build-stub-held-stat.ts';

function setupTest() {
  return { buildStubHeldStat };
}

test('it answers that the path is a folder, and only after it held the loop for the time', async () => {
  const ctx = setupTest();
  const startedAtMs = performance.now();

  const info = await ctx.buildStubHeldStat(30)('/work/docks');

  expect([info.isDirectory(), performance.now() - startedAtMs >= 30]).toStrictEqual([true, true]);
});
