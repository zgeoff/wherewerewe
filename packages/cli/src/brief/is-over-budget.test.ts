import { expect, test } from 'bun:test';
import { isOverBudget } from './is-over-budget.ts';

test.each([
  { text: 'abcd\nefgh\n', expected: false },
  { text: 'a\nb\nc\n', expected: true },
  { text: 'abcdefghijk\n', expected: true },
  { text: 'éééééééééé\n', expected: true },
])('it says $expected about the text $text', (row) => {
  expect(isOverBudget(row.text, { maxLines: 2, maxCharacters: 10, taskRows: 6 })).toStrictEqual(
    row.expected,
  );
});
