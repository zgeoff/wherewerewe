import { expect, test } from 'bun:test';
import { buildMockIDs } from './build-mock-ids.ts';

test('it builds numbered ids of 16 characters', () => {
  expect(buildMockIDs('task', 2)).toStrictEqual(['task01xxxxxxxxxx', 'task02xxxxxxxxxx']);
});
