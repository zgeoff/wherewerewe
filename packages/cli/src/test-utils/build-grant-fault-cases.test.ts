import { expect, test } from 'bun:test';
import { buildGrantFaultCases } from './build-grant-fault-cases.ts';

test('it builds each of the 13 faults alone, each of the 78 pairs, and all 13 at once', () => {
  expect(buildGrantFaultCases()).toHaveLength(92);
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

test('it builds the command of no bullet with a scope and no --may', () => {
  const found = buildGrantFaultCases().find((entry) => entry.title === 'no bullet');

  expect(found?.argv).toStrictEqual([
    'grant',
    '--scope',
    'in garden-api',
    '--reading',
    'covers watering',
    '--where',
    'chat',
  ]);
});
