import { expect, test } from 'bun:test';
import { buildGrantFaultCases } from './build-grant-fault-cases.ts';

test('it builds each of the 8 faults alone, each of the 28 pairs, and all 8 at once', () => {
  expect(buildGrantFaultCases()).toHaveLength(37);
});

test('it builds the plain command for one fault with no value after --where', () => {
  const found = buildGrantFaultCases().find((entry) => entry.title === 'a --where with no value');

  expect(found?.argv).toStrictEqual([
    'grant',
    '--may',
    'water',
    '--reading',
    'covers watering',
    '--where',
  ]);
});
