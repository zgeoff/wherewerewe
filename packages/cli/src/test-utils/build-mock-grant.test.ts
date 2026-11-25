import { expect, test } from 'bun:test';
import { buildMockGrant } from './build-mock-grant.ts';

function setupTest() {
  return { buildMockGrant };
}

test('it lays the fields of the test over a grant with no bullet', () => {
  const ctx = setupTest();

  expect(ctx.buildMockGrant({ may: ['water the beds'], scope: 'in the east bed' })).toStrictEqual({
    may: ['water the beds'],
    not: [],
    never: [],
    scope: 'in the east bed',
    reading: 'covers it',
    where: 'chat',
    set: '2026-03-10T09:00:00Z',
  });
});
