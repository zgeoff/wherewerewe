import { expect, test } from 'bun:test';
import { estimateTokens } from './estimate-tokens.ts';

test.each([
  { bytes: 1, expected: 1 },
  { bytes: 3, expected: 1 },
  { bytes: 4, expected: 2 },
  { bytes: 4228, expected: 1410 },
])('it estimates $expected tokens for $bytes bytes', (row) => {
  expect(estimateTokens('x'.repeat(row.bytes))).toBe(row.expected);
});

test('it counts a character of 3 bytes as 1 token', () => {
  expect(estimateTokens('語')).toBe(1);
});
