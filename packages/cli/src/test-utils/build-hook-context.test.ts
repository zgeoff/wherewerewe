import { expect, test } from 'bun:test';
import { buildHookContext } from './build-hook-context.ts';

function setupTest() {
  return { build: buildHookContext };
}

test('it builds a context with the root, a fixed clock and no fault', () => {
  const ctx = setupTest();
  const context = ctx.build('/work/state/wherewerewe');

  expect({ root: context.root, now: context.now(), fault: context.fault }).toStrictEqual({
    root: '/work/state/wherewerewe',
    now: Date.parse('2026-03-10T11:43:00Z'),
    fault: null,
  });
});
