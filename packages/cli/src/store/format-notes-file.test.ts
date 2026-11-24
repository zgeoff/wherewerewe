import { expect, test } from 'bun:test';
import { formatNotesFile } from './format-notes-file.ts';
import { parseNotesFile } from './parse-notes-file.ts';

test('it writes the header and each row, with owed or a dash', () => {
  const text = formatNotesFile([
    { id: 't-a', owed: true, written: '2026-03-10T10:31:09Z', note: 'Stop the simulator first' },
    { id: 'w-b', owed: false, written: '2026-03-10T10:32:09Z', note: 'Vendor replies on Fridays' },
  ]);

  expect(text).toBe(
    [
      'id\towed\twritten\tnote',
      't-a\towed\t2026-03-10T10:31:09Z\tStop the simulator first',
      'w-b\t-\t2026-03-10T10:32:09Z\tVendor replies on Fridays',
      '',
    ].join('\n'),
  );
});

test('it round-trips through the parser, and writes only the header for no notes', () => {
  const notes = [
    { id: 't-a', owed: true, written: '2026-03-10T10:31:09Z', note: 'Stop the simulator first' },
  ] as const;

  const actual: unknown = parseNotesFile(formatNotesFile(notes));

  expect(actual).toStrictEqual({ kind: 'notes', notes });
  expect(formatNotesFile([])).toBe('id\towed\twritten\tnote\n');
});
