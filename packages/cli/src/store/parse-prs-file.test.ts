import { expect, test } from 'bun:test';
import { formatPrsFile } from './format-prs-file.ts';
import { parsePrsFile } from './parse-prs-file.ts';

test('it reads the header alone as no rows', () => {
  expect(parsePrsFile('ref\topened\tstate\tseen\n')).toStrictEqual({ kind: 'prs', prs: [] });
});

test('it reads a round trip through the formatter, with a dash as no state and no time', () => {
  const prs = [
    {
      ref: 'bosunhq/bosun-app#64',
      opened: '2026-03-10T08:41:30Z',
      state: 'OPEN',
      seen: '2026-03-10T11:43:04Z',
    },
    { ref: 'tidal-org/tidekit#19', opened: '2026-03-10T09:00:00Z', state: null, seen: null },
  ] as const;

  expect(parsePrsFile(formatPrsFile(prs))).toStrictEqual({ kind: 'prs', prs });
});

test.each([
  {
    title: 'a changed header',
    text: 'ref\topened\n',
    line: 1,
    reason: 'the header row is missing or changed',
    prs: [],
  },
  {
    title: 'a row with 3 columns',
    text: 'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\n',
    line: 2,
    reason: 'expected 4 tab-separated columns, found 3',
    prs: [],
  },
  {
    title: 'a bad ref',
    text: 'ref\topened\tstate\tseen\nbosun-app 64\t2026-03-10T08:41:30Z\tOPEN\t-\n',
    line: 2,
    reason: 'the ref is not <owner>/<repo>#<n>',
    prs: [],
  },
  {
    title: 'a bad opened time',
    text: 'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\tyesterday\tOPEN\t-\n',
    line: 2,
    reason: 'the opened time is not an ISO 8601 UTC time to the second, ending in Z',
    prs: [],
  },
  {
    title: 'a bad state',
    text: 'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tDRAFT\t-\n',
    line: 2,
    reason: 'the state is not OPEN, MERGED, CLOSED or -',
    prs: [],
  },
  {
    title: 'a bad seen time',
    text: 'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\tnow\n',
    line: 2,
    reason: 'the seen is not - or an ISO 8601 UTC time to the second, ending in Z',
    prs: [],
  },
  {
    title: 'a repeated ref',
    text: 'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t-\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t-\n',
    line: 3,
    reason: 'the ref repeats an earlier row',
    prs: [
      { ref: 'bosunhq/bosun-app#64', opened: '2026-03-10T08:41:30Z', state: 'OPEN', seen: null },
    ],
  },
])('it names the first row that does not parse, for $title, and keeps the rows that do', (row) => {
  expect(parsePrsFile(row.text)).toStrictEqual({
    kind: 'broken',
    line: row.line,
    reason: row.reason,
    prs: row.prs,
  });
});
