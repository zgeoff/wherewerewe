import { expect, test } from 'bun:test';
import { buildWriteFaultCases } from './build-write-fault-cases.ts';

test('it builds 8 faults for each of the 8 id slots, 7 for the session name, 5 for each of the 26 text slots, and 5 for every slot at once of the 16 commands', () => {
  expect(buildWriteFaultCases()).toHaveLength(8 * 8 + 7 + 26 * 5 + 16 * 5);
});

test('it puts a fault in each slot of a command at once', () => {
  const found = buildWriteFaultCases().find((entry) => entry.title === 'wait, every slot: a dash');

  expect(found?.argv).toStrictEqual(['wait', 'T-B', '-', '--who', '-']);
});
