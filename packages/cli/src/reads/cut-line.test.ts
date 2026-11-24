import { expect, test } from 'bun:test';
import { cutLine } from './cut-line.ts';

test.each([
  ['a line of 100 code points', 'a'.repeat(100), 'a'.repeat(100)],
  ['a line of 101 code points', 'a'.repeat(101), `${'a'.repeat(99)}…`],
  ['a line of 100 code points with 2 UTF-16 units each', '😀'.repeat(100), '😀'.repeat(100)],
  ['a line of 101 emoji', '😀'.repeat(101), `${'😀'.repeat(99)}…`],
  ['a line with a degree sign at the cut', `${'a'.repeat(98)}°bc`, `${'a'.repeat(98)}°…`],
])('it cuts %s as the contract says', (_title, line, expected) => {
  expect(cutLine(line)).toBe(expected);
});
