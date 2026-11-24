import { expect, test } from 'bun:test';
import { parseNotesFile } from './parse-notes-file.ts';

test('it reads rows, with owed as true and a dash as false', () => {
  const text = `id\towed\twritten\tnote\nt-a\towed\t2026-03-10T10:31:09Z\tStop the simulator first\nw-b\t-\t2026-03-10T10:32:09Z\tVendor replies on Fridays\n`;

  expect(parseNotesFile(text)).toStrictEqual({
    kind: 'notes',
    notes: [
      { id: 't-a', owed: true, written: '2026-03-10T10:31:09Z', note: 'Stop the simulator first' },
      {
        id: 'w-b',
        owed: false,
        written: '2026-03-10T10:32:09Z',
        note: 'Vendor replies on Fridays',
      },
    ],
  });
});

test.each([
  ['a changed header', 'id\tnote\n', 1, 'the header row is missing or changed'],
  [
    'a row with 3 columns',
    `id\towed\twritten\tnote\nt-a\t-\twritten\n`,
    2,
    'expected 4 tab-separated columns, found 3',
  ],
  [
    'a bad id',
    `id\towed\twritten\tnote\nT-A\t-\t2026-03-10T10:31:09Z\tx\n`,
    2,
    'the id is not an item id',
  ],
  [
    'an owed that is neither word',
    `id\towed\twritten\tnote\nt-a\tyes\t2026-03-10T10:31:09Z\tx\n`,
    2,
    'the owed column is not owed or -',
  ],
  [
    'an empty written time',
    `id\towed\twritten\tnote\nt-a\t-\t\tx\n`,
    2,
    'the written time is not an ISO 8601 UTC time to the second, ending in Z',
  ],
  [
    'a written time that is not a time',
    `id\towed\twritten\tnote\nt-a\t-\tnot-a-time\tx\n`,
    2,
    'the written time is not an ISO 8601 UTC time to the second, ending in Z',
  ],
  [
    'a note with a credential',
    `id\towed\twritten\tnote\nt-a\towed\t2026-03-10T10:31:09Z\tkey AKIA${'Q'.repeat(16)}\n`,
    2,
    'the note holds a credential',
  ],
  [
    'an empty note',
    `id\towed\twritten\tnote\nt-a\t-\t2026-03-10T10:31:09Z\t\n`,
    2,
    'the note is empty, longer than 400 characters or not one line',
  ],
  [
    'a note of 401 characters',
    `id\towed\twritten\tnote\nt-a\t-\t2026-03-10T10:31:09Z\t${'a'.repeat(401)}\n`,
    2,
    'the note is empty, longer than 400 characters or not one line',
  ],
  [
    'a repeated id',
    `id\towed\twritten\tnote\nt-a\t-\t2026-03-10T10:31:09Z\tx\nt-a\t-\t2026-03-10T10:31:09Z\ty\n`,
    3,
    'the id repeats an earlier row',
  ],
])('it reports %s on the line of the first broken row', (_name, text, line, reason) => {
  const actual = parseNotesFile(text);

  expect(actual.kind === 'broken' && { line: actual.line, reason: actual.reason }).toStrictEqual({
    line,
    reason,
  });
});

test('it keeps the rows that parse beside the first broken row', () => {
  expect(
    parseNotesFile(
      `id\towed\twritten\tnote\nt-a\t-\t2026-03-10T10:31:09Z\tx\nBAD\t-\t2026-03-10T10:31:09Z\ty\nt-b\towed\t2026-03-10T10:31:09Z\tz\n`,
    ),
  ).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: 'the id is not an item id',
    notes: [
      { id: 't-a', owed: false, written: '2026-03-10T10:31:09Z', note: 'x' },
      { id: 't-b', owed: true, written: '2026-03-10T10:31:09Z', note: 'z' },
    ],
  });
});
