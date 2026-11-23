import { expect, test } from 'bun:test';
import { getSessionDay } from './get-session-day.ts';

test.each([
  ['2026-03-02T08:04:11Z', '2026-03-02T08:10:00Z', 1],
  ['2026-03-02T23:59:59Z', '2026-03-03T00:00:01Z', 2],
  ['2026-03-02T08:04:11Z', '2026-03-10T11:43:00Z', 9],
  ['2026-02-27T08:04:11Z', '2026-03-02T00:00:00Z', 4],
])('it counts the day of a session started %s at %s as %p', (started, now, expected) => {
  expect(getSessionDay(started, Date.parse(now))).toBe(expected);
});
