import { expect, test } from 'bun:test';
import { parseSince } from './parse-since.ts';

test.each([
  ['24h', '2026-03-09T11:43:00Z'],
  ['3d', '2026-03-07T11:43:00Z'],
  ['1h', '2026-03-10T10:43:00Z'],
  ['day-7', '2026-03-08T00:00:00Z'],
  ['day-1', '2026-03-02T00:00:00Z'],
])('it reads %s as the time %s', (text, expected) => {
  const fromMs = parseSince(text, Date.parse('2026-03-10T11:43:00Z'), '2026-03-02T08:04:11Z');

  expect(fromMs).toBe(Date.parse(expected));
});

test.each([['yesterday'], ['24'], ['h'], ['-3d'], ['3 d'], ['day-'], ['day7'], ['1.5h'], ['']])(
  'it reads %p as nothing',
  (text) => {
    const fromMs = parseSince(text, Date.parse('2026-03-10T11:43:00Z'), '2026-03-02T08:04:11Z');

    expect(fromMs).toBeNull();
  },
);
