import { expect, test } from 'bun:test';
import { collectStringLeaves } from './collect-string-leaves.ts';

function setupTest() {
  return { collectStringLeaves };
}

test.each([
  { title: 'a string', value: 'x', expected: [''] },
  {
    title: 'a number, a boolean and null',
    value: { count: 1, isOpen: true, note: null },
    expected: [],
  },
  {
    title: 'nested objects and arrays, with one path for the rows of an array',
    value: { rows: [{ row: { id: 'a' } }, { row: { id: 'b' } }], goal: 'x' },
    expected: ['rows.[].row.id', 'rows.[].row.id', 'goal'],
  },
])('it collects the paths of the strings in $title', (row) => {
  const ctx = setupTest();

  expect(ctx.collectStringLeaves(row.value)).toStrictEqual([...row.expected]);
});

test('it collects only the paths of the strings it is told to keep', () => {
  const ctx = setupTest();
  const value = { rows: [{ id: 't-a' }, { id: 't-b' }], focus: 't-a' };

  expect(ctx.collectStringLeaves(value, [], (text) => text === 't-a')).toStrictEqual([
    'rows.[].id',
    'focus',
  ]);
});
