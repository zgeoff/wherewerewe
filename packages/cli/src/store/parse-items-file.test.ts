import { expect, test } from 'bun:test';
import { parseItemsFile } from './parse-items-file.ts';

test('it reads rows, with a dash as an empty cell and extra as pairs', () => {
  const text = `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\tpr:acme/tool#7\t-\t-\t2026-03-10T10:31:09Z\tagent\tblocked_by=w-a\nok-m\tok\tmerge it\t-\t-\t-\t2026-03-02T08:09:47Z\towner\twho=owner;scope=app\n`;

  expect(parseItemsFile(text, '2')).toStrictEqual({
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
        extra: { who: 'owner', scope: 'app' },
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
    'a claim of one dash',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\t-\t-\t-\t-\tw\tagent\t-\n`,
    2,
    'the claim is empty',
  ],
  [
    'an empty claim',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\t\t-\t-\t-\tw\tagent\t-\n`,
    2,
    'the claim is empty',
  ],
  [
    'a use key, which format 2 has none of',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-a\tok\tx\t-\t-\t-\tw\tagent\tuse=once\n`,
    2,
    'the key use is not in format 2',
  ],
  [
    'an item with the id grant',
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\ngrant\ttask\tx\t-\t-\t-\tw\tagent\t-\n`,
    2,
    "the id grant is the grant's",
  ],
])('it breaks on %s', (_title, text, line, reason) => {
  expect(parseItemsFile(text, '2')).toStrictEqual({ kind: 'broken', line, reason, items: [] });
});

test('it keeps the rows that parse beside the first row that does not', () => {
  const text =
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n` +
    `t-b\ttask\tWrite it\t-\t-\t-\t2026-03-10T10:31:09Z\tagent\t-\n` +
    `t-c\tchore\tx\t-\t-\t-\tw\tagent\t-\n`;

  expect(parseItemsFile(text, '2')).toStrictEqual({
    kind: 'broken',
    line: 2,
    reason: 'expected 9 tab-separated columns, found 2',
    items: [expect.objectContaining({ id: 't-b' })],
  });
});

test('it reads a use key and an item with the id grant in format 1', () => {
  const text =
    `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n` +
    `ok-m\tok\tmerge it\t-\t-\t-\t2026-03-02T08:09:47Z\towner\twho=owner;use=standing\n` +
    `grant\ttask\tx\t-\t-\t-\t2026-03-02T08:09:47Z\tagent\t-\n`;

  expect(parseItemsFile(text, '1')).toStrictEqual({
    kind: 'items',
    items: [
      expect.objectContaining({ id: 'ok-m', extra: { who: 'owner', use: 'standing' } }),
      expect.objectContaining({ id: 'grant', extra: {} }),
    ],
  });
});

test('it breaks a format 1 row whose use is not once or standing', () => {
  const text = `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\tok\tx\t-\t-\t-\tw\tagent\tuse=often\n`;

  expect(parseItemsFile(text, '1')).toStrictEqual({
    kind: 'broken',
    line: 2,
    reason: 'the use "often" is not once or standing',
    items: [],
  });
});
