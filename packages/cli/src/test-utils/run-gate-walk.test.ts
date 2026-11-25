import { expect, test } from 'bun:test';
import { runGateWalk } from './run-gate-walk.ts';

function setupTest() {
  return { runGateWalk };
}

test.each([
  { depth: 8, isAssumingNoStartInFlight: true },
  { depth: 8, isAssumingNoStartInFlight: false },
  { depth: 12, isAssumingNoStartInFlight: true },
  { depth: 12, isAssumingNoStartInFlight: false },
])(
  'it finds no failure to depth $depth when no start in flight is $isAssumingNoStartInFlight',
  (row) => {
    const ctx = setupTest();
    const result = ctx.runGateWalk({ ...row, isStopActiveFree: true });

    expect(result.failures.slice(0, 3)).toStrictEqual([]);
  },
);

test('it visits more nodes when a start may come while a read runs', () => {
  const ctx = setupTest();

  const assumed = ctx.runGateWalk({
    depth: 8,
    isAssumingNoStartInFlight: true,
    isStopActiveFree: true,
  });

  const free = ctx.runGateWalk({
    depth: 8,
    isAssumingNoStartInFlight: false,
    isStopActiveFree: true,
  });

  expect(free.checked).toBeGreaterThan(assumed.checked);
});
