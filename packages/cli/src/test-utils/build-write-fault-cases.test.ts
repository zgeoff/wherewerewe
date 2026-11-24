import { expect, test } from 'bun:test';
import { buildWriteFaultCases } from './build-write-fault-cases.ts';

test('it builds 8 faults for each of the 5 id slots, 7 for the session name, 5 for each of the 19 text slots, and 5 for every slot at once of the 13 commands', () => {
  expect(buildWriteFaultCases()).toHaveLength(5 * 8 + 7 + 19 * 5 + 13 * 5);
});

test('it puts a fault in each slot of a command at once', () => {
  const found = buildWriteFaultCases().find((entry) => entry.title === 'wait, every slot: a dash');

  expect(found?.argv).toStrictEqual(['wait', 'T-B', '-', '--who', '-']);
});
