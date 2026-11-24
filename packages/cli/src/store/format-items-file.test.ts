import { expect, test } from 'bun:test';
import { formatItemsFile } from './format-items-file.ts';
import { parseItemsFile } from './parse-items-file.ts';

test('it writes the header and each row, with extra keys in a fixed order', () => {
  const text = formatItemsFile([
    {
      id: 'w-a',
      kind: 'wait',
      claim: 'Answer from the vendor',
      check: null,
      atWrite: null,
      last: null,
      written: '2026-03-10T10:31:09Z',
      by: 'agent',
      extra: { who: 'vendor' },
    },
    {
      id: 'ok-m',
      kind: 'ok',
      claim: 'merge it',
      check: 'pid:42',
      atWrite: 'alive',
      last: 'alive',
      written: '2026-03-02T08:09:47Z',
      by: 'owner',
      extra: { pid_start: '9', scope: 'app', where: 'terminal', who: 'owner' },
    },
  ]);

  expect(text).toBe(
    [
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      'w-a\twait\tAnswer from the vendor\t-\t-\t-\t2026-03-10T10:31:09Z\tagent\twho=vendor',
      'ok-m\tok\tmerge it\tpid:42\talive\talive\t2026-03-02T08:09:47Z\towner\twho=owner;where=terminal;scope=app;pid_start=9',
      '',
    ].join('\n'),
  );
});

test('it round-trips through the parser, and writes only the header for no items', () => {
  const items = [
    {
      id: 't-a',
      kind: 'task',
      claim: 'Write it',
      check: 'pr:acme/tool#7',
      atWrite: null,
      last: null,
      written: '2026-03-10T10:31:09Z',
      by: 'agent',
      extra: { blocked_by: 'w-a' },
    },
  ] as const;

  const actual: unknown = parseItemsFile(formatItemsFile(items), '2');

  expect(actual).toStrictEqual({ kind: 'items', items });
  expect(formatItemsFile([])).toBe('id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n');
});
