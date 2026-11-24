import { expect, test } from 'bun:test';
import { withOwed } from './with-owed.ts';

test.each([
  { isOwed: true, expected: 'no check · 1h · owed' },
  { isOwed: false, expected: 'no check · 1h' },
])('it gives the tag $expected when owed is $isOwed', (row) => {
  expect(withOwed('no check · 1h', row.isOwed)).toStrictEqual(row.expected);
});
