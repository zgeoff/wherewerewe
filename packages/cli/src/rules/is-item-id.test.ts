import { expect, test } from 'bun:test';
import { isItemID } from './is-item-id.ts';

test.each([
  ['a', false],
  ['ab', true],
  ['t-e2e', true],
  ['abcdefghijklmnop', true],
  ['abcdefghijklmnopq', false],
  ['T-e2e', false],
  ['2fa', false],
  ['-ab', false],
  ['d-4', false],
  ['o-12', false],
  ['do-4', true],
  ['d-x', true],
  ['t_a', false],
  ['grant', false],
  ['grants', true],
  ['g-rant', true],
])('it answers %s with %p', (id, expected) => {
  expect(isItemID(id)).toBe(expected);
});
