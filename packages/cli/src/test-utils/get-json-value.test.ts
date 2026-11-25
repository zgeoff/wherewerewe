import { expect, test } from 'bun:test';
import { getJsonValue } from './get-json-value.ts';

function setupTest() {
  return { getJsonValue, value: { rows: [{ id: 'a' }, { id: 'b' }], goal: 'x' } };
}

test.each([
  { path: ['goal'], expected: 'x' },
  { path: ['rows', 1, 'id'], expected: 'b' },
  { path: ['rows', 2, 'id'], expected: null },
  { path: ['goal', 'length'], expected: null },
  { path: ['rows', 'length'], expected: null },
  { path: ['missing', 0], expected: null },
])('it reads the path $path of a JSON value as $expected', (row) => {
  const ctx = setupTest();

  expect(ctx.getJsonValue(ctx.value, row.path)).toBe(row.expected);
});
