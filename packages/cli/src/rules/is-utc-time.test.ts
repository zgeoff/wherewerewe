import { expect, test } from 'bun:test';
import { isUTCTime } from './is-utc-time.ts';

test.each([
  ['a time to the second', '2026-03-10T10:31:09Z', true],
  ['a leap day', '2028-02-29T00:00:00Z', true],
  ['a word', 'not-a-time', false],
  ['an empty text', '', false],
  ['a time with milliseconds', '2026-03-10T10:31:09.000Z', false],
  ['a time with an offset', '2026-03-10T10:31:09+00:00', false],
  ['a date with no time', '2026-03-10', false],
  ['a day that does not exist', '2026-02-30T10:31:09Z', false],
])('it checks %s', (_title, text, expected) => {
  expect(isUTCTime(text)).toBe(expected);
});
