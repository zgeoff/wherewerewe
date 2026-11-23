import { expect, test } from 'bun:test';
import { formatSessionLines } from './format-session-lines.ts';

test.each([
  [
    'a store of format 2 with no other field read',
    { name: 'sample', format: '2', started: null, lastWrite: null, goal: null },
    '  sample  format 2: this www reads format 1',
  ],
  [
    'a hand-kept store',
    { name: 'sample', format: '0-by-hand', started: null, lastWrite: null, goal: null },
    '  sample  hand-kept: run www import sample',
  ],
  [
    'a session file that does not parse',
    { name: 'sample', format: null, started: null, lastWrite: null, goal: null },
    '  sample  unreadable session file',
  ],
  [
    'a format 1 session',
    {
      name: 'sample',
      format: '1',
      started: '2026-03-09T08:00:00Z',
      lastWrite: '2026-03-10T10:43:00Z',
      goal: 'Ship it',
    },
    '  sample  day 2  last write 1h ago  Ship it',
  ],
])('it writes the line for %s', (_title, summary, expected) => {
  expect(formatSessionLines([summary], Date.parse('2026-03-10T11:43:00Z'))).toBe(expected);
});

test('it says how to start a session when there is none', () => {
  expect(formatSessionLines([], Date.parse('2026-03-10T11:43:00Z'))).toBe(
    'No sessions on this machine yet. Run: www init <name> --goal "<what done means>"',
  );
});
