import { expect, test } from 'bun:test';
import { parseItemsFile } from './parse-items-file.ts';

test('it reads rows, with a dash as an empty cell and extra as pairs', () => {
  const text = `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\tpr:acme/tool#7\t-\t-\t2026-03-10T10:31:09Z\tagent\tblocked_by=w-a\nok-m\tok\tmerge it\t-\t-\t-\t2026-03-02T08:09:47Z\towner\twho=owner;use=standing\n`;

  expect(parseItemsFile(text)).toStrictEqual({
    kind: 'items',
    items: [
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
      {
        id: 'ok-m',
        kind: 'ok',
        claim: 'merge it',
        check: null,
        atWrite: null,
        last: null,
        written: '2026-03-02T08:09:47Z',
        by: 'owner',
        extra: { who: 'owner', use: 'standing' },
      },
    ],
  });
});

test.each([
  ['a changed header', 'id\tkind\n', 1, 'the header row is missing or changed'],
  [
    'a short row',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n`,
    2,
    'expected 9 tab-separated columns, found 2',
  ],
  [
    'an unknown kind',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\tchore\tx\t-\t-\t-\tw\tagent\t-\n`,
    2,
    'the kind "chore" is not task, wait, ok, rule or where',
  ],
  [
    'an unknown author',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tx\t-\t-\t-\tw\trobot\t-\n`,
    2,
    'the author "robot" is not agent, owner or import',
  ],
  [
    'an unknown extra key',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tx\t-\t-\t-\tw\tagent\tcolour=red\n`,
    2,
    'the extra "colour=red" is not a known key=value pair',
  ],
  [
    'a bad use',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\tok\tx\t-\t-\t-\tw\tagent\tuse=often\n`,
    2,
    'the use "often" is not once or standing',
  ],
])('it breaks on %s', (_title, text, line, reason) => {
  expect(parseItemsFile(text)).toStrictEqual({ kind: 'broken', line, reason, items: [] });
});

test('it keeps the rows that parse beside the first row that does not', () => {
  const text =
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n` +
    `t-b\ttask\tWrite it\t-\t-\t-\t2026-03-10T10:31:09Z\tagent\t-\n` +
    `t-c\tchore\tx\t-\t-\t-\tw\tagent\t-\n`;

  expect(parseItemsFile(text)).toStrictEqual({
    kind: 'broken',
    line: 2,
    reason: 'expected 9 tab-separated columns, found 2',
    items: [expect.objectContaining({ id: 't-b' })],
  });
});
