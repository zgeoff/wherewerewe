import { expect, test } from 'bun:test';
import { countGrantWords } from './count-grant-words.ts';

test('it counts every bullet and the scope in code points', () => {
  expect(
    countGrantWords({
      may: ['water the beds', 'é'],
      not: ['prune'],
      never: ['dig up the roses'],
      scope: 'in the east garden',
    }),
  ).toBe(14 + 1 + 5 + 16 + 18);
});

test('it counts a grant with no scope as its bullets alone', () => {
  expect(countGrantWords({ may: ['water the beds'], not: [], never: [], scope: null })).toBe(14);
});
