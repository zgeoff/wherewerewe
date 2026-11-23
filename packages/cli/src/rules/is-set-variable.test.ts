import { expect, test } from 'bun:test';
import { isSetVariable } from './is-set-variable.ts';

test.each([
  [undefined, false],
  ['', false],
  ['1', true],
  [' ', true],
])('it reads %p as set: %p', (value, expected) => {
  expect(isSetVariable(value)).toBe(expected);
});
