import { expect, test } from 'bun:test';
import { buildStubHeldStat } from './build-stub-held-stat.ts';

test('it answers that the path is a folder, and only after it held the loop for the time', async () => {
  const startedAtMs = performance.now();

  const info = await buildStubHeldStat(30)('/work/docks');

  expect([info.isDirectory(), performance.now() - startedAtMs >= 30]).toStrictEqual([true, true]);
});
