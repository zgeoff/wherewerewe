import { expect, test } from 'bun:test';
import { isSessionName } from './is-session-name.ts';

test.each([
  ['a', false],
  ['ab', true],
  ['tide-alerts', true],
  ['abcdefghijklmnopqrstuvwx', true],
  ['abcdefghijklmnopqrstuvwxy', false],
  ['Tide', false],
  ['1abc', false],
  ['a/b', false],
  ['../x', false],
])('it answers %s with %p', (name, expected) => {
  expect(isSessionName(name)).toBe(expected);
});
