import { expect, test } from 'bun:test';
import { buildGrantFaultCases } from './build-grant-fault-cases.ts';

test('it builds each of the 10 faults alone, each of the 45 pairs, and all 10 at once', () => {
  expect(buildGrantFaultCases()).toHaveLength(56);
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
