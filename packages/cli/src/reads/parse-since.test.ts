import { expect, test } from 'bun:test';
import { isSinceText, parseSince } from './parse-since.ts';

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

test.each([
  ['yesterday'],
  ['24'],
  ['h'],
  ['-3d'],
  ['3 d'],
  ['day-'],
  ['day7'],
  ['1.5h'],
  [''],
  ['day-100000002'],
  ['day-3000000'],
  ['99999999999999d'],
  [`${'9'.repeat(400)}h`],
])('it reads %p as nothing', (text) => {
  const fromMs = parseSince(text, Date.parse('2026-03-10T11:43:00Z'), '2026-03-02T08:04:11Z');

  expect(fromMs).toBeNull();
});

test.each([
  ['24h', true],
  ['3d', true],
  ['day-7', true],
  ['-2h', false],
  ['soon', false],
  ['', false],
  ['day-', false],
])('it reads whether %p is a time written as 24h, 3d or day-7: %p', (text, expected) => {
  expect(isSinceText(text)).toBe(expected);
});
