import { expect, test } from 'bun:test';
import { pickClosestID } from './pick-closest-id.ts';

test.each([
  ['w-apn', ['pr-api-77', 'w-apns', 'w-tk'], 'w-apns'],
  ['t-a', ['t-b', 't-c'], 't-b'],
  ['pr-app-78', ['pr-app-77', 'pr-api-77'], 'pr-app-77'],
  ['abcdef', ['uvwxyz'], null],
  ['abcd', ['abxx'], 'abxx'],
  ['abcd', ['axxx'], 'axxx'],
  ['abcdef', ['axxxxx'], null],
  ['t-a', [], null],
])('it picks for %s among %p the id %p', (typed, candidates, expected) => {
  expect(pickClosestID(typed, candidates)).toBe(expected);
});
