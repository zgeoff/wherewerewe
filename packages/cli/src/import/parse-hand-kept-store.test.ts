import { expect, test } from 'bun:test';
import { parseHandKeptStore } from './parse-hand-kept-store.ts';

test('it keeps the line number of each session line and each row, and skips a blank line', () => {
  const result = parseHandKeptStore({
    session: 'name=old-notes\n\ngoal=Ship it\nformat=0-by-hand\n',
    items: 'id\tkind\tclaim\n\nt-a\ttask\tWrite it\n',
    journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n\n',
  });

  expect(result).toStrictEqual({
    session: [
      { line: 1, text: 'name=old-notes' },
      { line: 3, text: 'goal=Ship it' },
      { line: 4, text: 'format=0-by-hand' },
    ],
    items: {
      header: 'id\tkind\tclaim',
      rows: [{ line: 3, cells: ['t-a', 'task', 'Write it'] }],
    },
    journal: {
      header: 'ts\top\tid\ttext',
      rows: [{ line: 2, cells: ['2026-03-02T08:00:00Z', 'init', 'old-notes', 'Start'] }],
    },
  });
});

test.each([
  { title: 'a missing file', text: null },
  { title: 'an empty file', text: '' },
])('it reads $title as a table with no header and no rows', (row) => {
  const result = parseHandKeptStore({ session: 'name=x\n', items: row.text, journal: row.text });

  expect(result).toStrictEqual({
    session: [{ line: 1, text: 'name=x' }],
    items: { header: null, rows: [] },
    journal: { header: null, rows: [] },
  });
});

test('it keeps a row with the wrong number of columns whole', () => {
  const result = parseHandKeptStore({
    session: 'name=x\n',
    items: 'id\tkind\nt-a\ttask\textra\tmore\n',
    journal: null,
  });

  expect(result.items.rows).toStrictEqual([{ line: 2, cells: ['t-a', 'task', 'extra', 'more'] }]);
});
