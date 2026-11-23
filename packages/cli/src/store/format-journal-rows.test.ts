import { expect, test } from 'bun:test';
import { formatJournalRows } from './format-journal-rows.ts';
import { parseJournalFile } from './parse-journal-file.ts';

test('it ends every row in a newline and writes a dash for an empty cell', () => {
  const text = formatJournalRows([
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'task',
      id: 't-a',
      by: 'agent',
      text: 'Write it',
      why: null,
      extra: 'check=pid:42',
    },
    {
      ts: '2026-03-10T10:49:15Z',
      op: 'goal',
      id: 'tide',
      by: 'agent',
      text: 'x',
      why: null,
      extra: null,
    },
  ]);

  expect(text).toBe(
    '2026-03-10T10:48:15Z\ttask\tt-a\tagent\tWrite it\t-\tcheck=pid:42\n2026-03-10T10:49:15Z\tgoal\ttide\tagent\tx\t-\t-\n',
  );
});

test('it round-trips through the parser', () => {
  const rows = [
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'done',
      id: 't-a',
      by: 'agent',
      text: 'Write it',
      why: 'commit 4c1d2e0',
      extra: null,
    },
  ] as const;

  expect<unknown>(parseJournalFile(formatJournalRows(rows))).toStrictEqual(rows);
});
