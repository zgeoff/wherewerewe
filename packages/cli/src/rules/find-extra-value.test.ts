import { expect, test } from 'bun:test';
import { findExtraValue } from './find-extra-value.ts';

test.each([
  ['on=t-a;who=owner;replaces=d-2', 'who', 'owner'],
  ['on=t-a;who=owner;replaces=d-2', 'replaces', 'd-2'],
  ['on=t-a;who=owner', 'replaces', null],
  ['who=agent', 'who', 'agent'],
  [null, 'who', null],
  ['somewho=agent', 'who', null],
])('it finds %p key %s as %p', (extra, key, expected) => {
  expect(findExtraValue(extra, key)).toBe(expected);
});
