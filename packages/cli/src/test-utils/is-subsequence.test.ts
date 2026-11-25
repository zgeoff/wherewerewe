import { expect, test } from 'bun:test';
import { isSubsequence } from './is-subsequence.ts';

function setupTest() {
  return { check: isSubsequence };
}

test.each([
  { part: 'abc', whole: 'a1b2c3', expected: true },
  { part: 'abc', whole: 'acb', expected: false },
  { part: '', whole: 'xyz', expected: true },
  { part: 'abc', whole: 'ab', expected: false },
])('it is $expected for $part in $whole', (row) => {
  const ctx = setupTest();

  expect(ctx.check(row.part, row.whole)).toBe(row.expected);
});
