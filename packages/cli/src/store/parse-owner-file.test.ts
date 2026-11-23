import { expect, test } from 'bun:test';
import { formatOwnerFile } from './format-owner-file.ts';
import { parseOwnerFile } from './parse-owner-file.ts';

test('it reads the header alone as no notes', () => {
  expect(parseOwnerFile(`id\ttext\tsaid\ton\n`)).toStrictEqual({ kind: 'notes', notes: [] });
});

test('it reads a note round trip through the formatter', () => {
  const notes = [
    { id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null },
    { id: 'o-3', text: 'Use the recorded readings', said: '2026-03-10T11:05:00Z', on: 't-timer' },
  ];

  expect(parseOwnerFile(formatOwnerFile(notes))).toStrictEqual({ kind: 'notes', notes });
});

test.each([
  {
    title: 'a changed header',
    text: 'id\ttext\n',
    line: 1,
    reason: 'the header row is missing or changed',
    notes: [],
  },
  {
    title: 'a row with 3 columns',
    text: `id\ttext\tsaid\ton\no-1\tAsk first\t2026-03-10T11:00:00Z\t-\no-2\tx\ty\n`,
    line: 3,
    reason: 'expected 4 tab-separated columns, found 3',
    notes: [{ id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null }],
  },
  {
    title: 'a bad id',
    text: `id\ttext\tsaid\ton\nowner-1\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id is not o-<n>',
    notes: [],
  },
  {
    title: 'an id of o-0',
    text: `id\ttext\tsaid\ton\no-0\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id is not o-<n>',
    notes: [],
  },
  {
    title: 'an empty text',
    text: `id\ttext\tsaid\ton\no-1\t\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the text is empty, longer than 160 characters or not one line',
    notes: [],
  },
  {
    title: 'a text of 161 characters',
    text: `id\ttext\tsaid\ton\no-1\t${'x'.repeat(161)}\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the text is empty, longer than 160 characters or not one line',
    notes: [],
  },
  {
    title: 'an empty said',
    text: `id\ttext\tsaid\ton\no-1\tx\t\t-\n`,
    line: 2,
    reason: 'the said time is not an ISO 8601 UTC time to the second, ending in Z',
    notes: [],
  },
  {
    title: 'a said that is not a time',
    text: `id\ttext\tsaid\ton\no-1\tx\tbogus\t-\n`,
    line: 2,
    reason: 'the said time is not an ISO 8601 UTC time to the second, ending in Z',
    notes: [],
  },
  {
    title: 'a said on a day the month does not have',
    text: `id\ttext\tsaid\ton\no-1\tx\t2026-02-30T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the said time is not an ISO 8601 UTC time to the second, ending in Z',
    notes: [],
  },
  {
    title: 'an id past the safe integers',
    text: `id\ttext\tsaid\ton\no-9007199254740992\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id is not o-<n>',
    notes: [],
  },
  {
    title: 'a credential in the id column',
    text: `id\ttext\tsaid\ton\nAKIA${'Q'.repeat(16)}\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id is not o-<n>',
    notes: [],
  },
  {
    title: 'a credential in the on column',
    text: `id\ttext\tsaid\ton\no-1\tx\t2026-03-10T11:00:00Z\tAKIA${'Q'.repeat(16)}\n`,
    line: 2,
    reason: 'the on is not - or an item id',
    notes: [],
  },
  {
    title: 'a bad on',
    text: `id\ttext\tsaid\ton\no-1\tx\t2026-03-10T11:00:00Z\tD-1\n`,
    line: 2,
    reason: 'the on is not - or an item id',
    notes: [],
  },
  {
    title: 'an id that repeats',
    text: `id\ttext\tsaid\ton\no-1\tAsk first\t2026-03-10T11:00:00Z\t-\no-1\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 3,
    reason: 'the id repeats an earlier row',
    notes: [{ id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null }],
  },
  {
    title: 'a third note',
    text: `id\ttext\tsaid\ton\no-1\tAsk first\t2026-03-10T11:00:00Z\t-\no-2\tx\t2026-03-10T11:00:00Z\t-\no-3\ty\t2026-03-10T11:00:00Z\t-\n`,
    line: 4,
    reason: 'more than 2 notes',
    notes: [
      { id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null },
      { id: 'o-2', text: 'x', said: '2026-03-10T11:00:00Z', on: null },
    ],
  },
])('it names the first broken row for $title and keeps the rows that parse', (row) => {
  const result = parseOwnerFile(row.text);

  expect(result).toStrictEqual({
    kind: 'broken',
    line: row.line,
    reason: row.reason,
    notes: row.notes,
  });
});
