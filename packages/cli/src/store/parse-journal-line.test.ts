import { expect, test } from 'bun:test';
import { parseJournalLine } from './parse-journal-line.ts';

test('it reads a row with a dash as null', () => {
  expect(
    parseJournalLine('2026-03-10T10:48:15Z\tdone\tt-a\tagent\tWrite it\tcommit 4c1d2e0\t-'),
  ).toStrictEqual({
    ts: '2026-03-10T10:48:15Z',
    op: 'done',
    id: 't-a',
    by: 'agent',
    text: 'Write it',
    why: 'commit 4c1d2e0',
    extra: null,
  });
});

test('it reads the header as no row', () => {
  expect(parseJournalLine('ts\top\tid\tby\ttext\twhy\textra')).toBeNull();
});

test('it reads a line with too few cells as no row', () => {
  expect(parseJournalLine('2026-03-10T10:48:15Z\tnow\tt-a')).toBeNull();
});

test('it reads a line with an unknown author as no row', () => {
  expect(parseJournalLine('2026-03-10T10:48:15Z\tnow\tt-a\tstranger\tgo\t-\t-')).toBeNull();
});
