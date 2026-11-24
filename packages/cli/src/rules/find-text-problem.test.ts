import { expect, test } from 'bun:test';
import { findTextProblem } from './find-text-problem.ts';

test.each([
  ['', 120, { kind: 'empty' }],
  ['-', 120, { kind: 'empty' }],
  ['--', 120, null],
  ['a\tb', 120, { kind: 'not-one-line' }],
  ['a\nb', 120, { kind: 'not-one-line' }],
  ['a\rb', 120, { kind: 'not-one-line' }],
  ['a\u2028b', 120, { kind: 'not-one-line' }],
  ['a\u2029b', 120, { kind: 'not-one-line' }],
  ['a\u0085b', 120, { kind: 'not-one-line' }],
  ['a\vb', 120, { kind: 'not-one-line' }],
  ['a\fb', 120, { kind: 'not-one-line' }],
  ['a'.repeat(120), 120, null],
  ['a'.repeat(121), 120, { kind: 'too-long', length: 121 }],
  ['😀'.repeat(120), 120, null],
  ['😀'.repeat(121), 120, { kind: 'too-long', length: 121 }],
])('it answers %p with limit %p with %p', (text, limit, expected) => {
  const actual: unknown = findTextProblem(text, limit);

  expect(actual).toStrictEqual(expected);
});
