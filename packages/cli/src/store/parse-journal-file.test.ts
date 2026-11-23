import { expect, test } from 'bun:test';
import { parseJournalFile } from './parse-journal-file.ts';

test('it reads rows with a dash as null and skips the header', () => {
  const text = `ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T10:48:15Z\tdone\tt-a\tagent\tWrite it\tcommit 4c1d2e0\t-\n`;

  expect(parseJournalFile(text)).toStrictEqual([
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'done',
      id: 't-a',
      by: 'agent',
      text: 'Write it',
      why: 'commit 4c1d2e0',
      extra: null,
    },
  ]);
});

test('it drops a last line that has no newline', () => {
  const text = `ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T10:48:15Z\tnow\tt-a\tagent\tgo\t-\t-\n2026-03-10T10:49:00Z\tnow\tt-b\tag`;

  expect(parseJournalFile(text)).toHaveLength(1);
});
