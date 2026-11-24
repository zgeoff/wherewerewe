import { expect, test } from 'bun:test';
import { buildCutPlacement, buildRedactionPlacements } from './build-redaction-placements.ts';

function setupTest() {
  return { placements: buildRedactionPlacements(), buildCut: buildCutPlacement };
}

test('it builds each placement around the sample, and the wrap placement starts at column 80 so it crosses 85 to 100', () => {
  const ctx = setupTest();
  const values = ctx.placements.map((placement) => placement.build('SAMPLE'));

  expect({
    holdsSample: values.every((value) => value.includes('SAMPLE')),
    wrapStart: values[1]?.indexOf('SAMPLE'),
  }).toStrictEqual({ holdsSample: true, wrapStart: 80 });
});

test('it holds the longest sample within 120 characters in each placement', () => {
  const ctx = setupTest();
  const longest = 'x'.repeat(31);

  expect(ctx.placements.map((placement) => placement.build(longest).length <= 120)).toStrictEqual([
    true,
    true,
    true,
  ]);
});

test('it starts the cut placement at column 190, so it crosses the cut at 199', () => {
  const ctx = setupTest();

  expect(ctx.buildCut('SAMPLE').indexOf('SAMPLE')).toBe(190);
});
