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
  },
  {
    title: 'a row with 3 columns',
    text: `id\ttext\tsaid\ton\no-1\tAsk first\t2026-03-10T11:00:00Z\t-\no-2\tx\ty\n`,
    line: 3,
    reason: 'expected 4 tab-separated columns, found 3',
  },
  {
    title: 'a bad id',
    text: `id\ttext\tsaid\ton\nowner-1\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id "owner-1" is not o-<n>',
  },
  {
    title: 'an id of o-0',
    text: `id\ttext\tsaid\ton\no-0\tx\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the id "o-0" is not o-<n>',
  },
  {
    title: 'an empty text',
    text: `id\ttext\tsaid\ton\no-1\t\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the text is empty, longer than 160 characters or not one line',
  },
  {
    title: 'a text of 161 characters',
    text: `id\ttext\tsaid\ton\no-1\t${'x'.repeat(161)}\t2026-03-10T11:00:00Z\t-\n`,
    line: 2,
    reason: 'the text is empty, longer than 160 characters or not one line',
  },
  {
    title: 'an empty said',
    text: `id\ttext\tsaid\ton\no-1\tx\t\t-\n`,
    line: 2,
    reason: 'the said time is empty',
  },
  {
    title: 'a bad on',
    text: `id\ttext\tsaid\ton\no-1\tx\t2026-03-10T11:00:00Z\tD-1\n`,
    line: 2,
    reason: 'the on "D-1" is not - or an item id',
  },
])('it names the first broken row for $title and keeps the rows that parse', (row) => {
  const result = parseOwnerFile(row.text);

  expect(result).toStrictEqual({
    kind: 'broken',
    line: row.line,
    reason: row.reason,
    notes:
      row.line === 3
        ? [{ id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null }]
        : [],
  });
});
