import { expect, test } from 'bun:test';
import { runCloseModel } from './run-close-model.ts';

function setupTest() {
  return { run: runCloseModel };
}

test('it gives the state after each step and the state the model expects, which match on a plain write and close', async () => {
  const ctx = setupTest();

  const result = await ctx.run(
    'promise',
    ['p-a'],
    [
      { op: 'write', id: 'p-a', text: 'Pin the clock', tick: 1 },
      { op: 'close', id: 'p-a', command: 'done', isInterrupted: false, tick: 1 },
      { op: 'write', id: 'p-a', text: 'Pin the clock', tick: 1 },
    ],
  );

  expect(result).toStrictEqual({
    actual: [
      { outcome: 'write', problems: [], closeRows: [0] },
      { outcome: 'write', problems: [], closeRows: [1] },
      { outcome: 'refused', problems: [], closeRows: [1] },
    ],
    expected: [
      { outcome: 'write', problems: [], closeRows: [0] },
      { outcome: 'write', problems: [], closeRows: [1] },
      { outcome: 'refused', problems: [], closeRows: [1] },
    ],
  });
});
