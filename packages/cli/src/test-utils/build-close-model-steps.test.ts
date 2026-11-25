import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { buildCloseModelSteps } from './build-close-model-steps.ts';

function setupTest() {
  return {
    sample: () => fc.sample(buildCloseModelSteps(['l-a', 'l-b']), { numRuns: 50, seed: 7 }),
  };
}

test('it builds at most 12 steps over the given ids only', () => {
  const ctx = setupTest();
  const runs = ctx.sample();
  const steps = runs.flat();

  expect({
    longest: Math.max(...runs.map((run) => run.length)),
    ids: [...new Set(steps.map((step) => step.id))].toSorted(),
  }).toStrictEqual({ longest: expect.toBeWithin(1, 13), ids: ['l-a', 'l-b'] });
});
