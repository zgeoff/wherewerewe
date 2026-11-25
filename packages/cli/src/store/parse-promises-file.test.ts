import { expect, test } from 'bun:test';
import { promisesHeader } from './constants.ts';
import { formatPromisesFile } from './format-promises-file.ts';
import { parsePromisesFile } from './parse-promises-file.ts';

function setupTest() {
  return { parse: parsePromisesFile, format: formatPromisesFile, header: promisesHeader };
}

test('it parses the example row of store.md and writes it back as it read it', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\ndue-cost\tCost table for the alert fan-out\towner\tday 10, before review\t2026-03-09T16:05:10Z\tagent\n`;

  const row = {
    id: 'due-cost',
    what: 'Cost table for the alert fan-out',
    to: 'owner',
    byWhen: 'day 10, before review',
    written: '2026-03-09T16:05:10Z',
    by: 'agent',
  } as const;

  expect({ parsed: ctx.parse(text), written: ctx.format([row]) }).toStrictEqual({
    parsed: { kind: 'rows', rows: [row] },
    written: text,
  });
});

test('it reads a file of a header alone as no rows', () => {
  const ctx = setupTest();

  expect(ctx.parse(`${ctx.header}\n`)).toStrictEqual({ kind: 'rows', rows: [] });
});

test.each([
  {
    title: 'a changed header',
    text: 'id\tother\n',
    line: 1,
    reason: 'the header row is missing or changed',
  },
  {
    title: 'a missing header',
    text: 'due-cost\tCost table for the alert fan-out\towner\tday 10, before review\t2026-03-09T16:05:10Z\tagent\n',
    line: 1,
    reason: 'the header row is missing or changed',
  },
])('it names $title as broken at line $line', (row) => {
  const ctx = setupTest();

  expect(ctx.parse(row.text)).toStrictEqual({
    kind: 'broken',
    line: row.line,
    reason: row.reason,
    rows: [],
  });
});

test.each([
  {
    title: 'an id that is no item id',
    line: `P-1\tx\towner\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the id is not an item id',
  },
  {
    title: 'an empty what',
    line: `p-a\t\towner\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the what is empty, longer than 120 characters or not one line',
  },
  {
    title: 'a what of 121 characters',
    line: `p-a\t${'x'.repeat(121)}\towner\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the what is empty, longer than 120 characters or not one line',
  },
  {
    title: 'an empty to',
    line: `p-a\tx\t\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the to is empty, longer than 16 characters, not one line or holds ; or =',
  },
  {
    title: 'a to of 17 characters',
    line: `p-a\tx\t${'t'.repeat(17)}\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the to is empty, longer than 16 characters, not one line or holds ; or =',
  },
  {
    title: 'a to that holds a semicolon',
    line: `p-a\tx\ta;b\tFriday\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the to is empty, longer than 16 characters, not one line or holds ; or =',
  },
  {
    title: 'a by_when that holds an equals sign',
    line: `p-a\tx\towner\ta=b\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the by_when is empty, longer than 24 characters, not one line or holds ; or =',
  },
  {
    title: 'a by_when of 25 characters',
    line: `p-a\tx\towner\t${'b'.repeat(25)}\t2026-03-09T16:05:10Z\tagent`,
    reason: 'the by_when is empty, longer than 24 characters, not one line or holds ; or =',
  },
  {
    title: 'a written time with no Z',
    line: `p-a\tx\towner\tFriday\t2026-03-09T16:05:10\tagent`,
    reason: 'the written time is not an ISO 8601 UTC time to the second, ending in Z',
  },
  {
    title: 'a by of hook',
    line: `p-a\tx\towner\tFriday\t2026-03-09T16:05:10Z\thook`,
    reason: 'the by column is not agent or owner',
  },
  {
    title: 'a row of 5 columns',
    line: `p-a\tx\towner\tFriday\t2026-03-09T16:05:10Z`,
    reason: 'expected 6 tab-separated columns, found 5',
  },
])('it leaves out $title, names it at line 3 and keeps the row before it', (row) => {
  const ctx = setupTest();
  const text = `${ctx.header}\ndue-cost\tCost table for the alert fan-out\towner\tday 10, before review\t2026-03-09T16:05:10Z\tagent\n${row.line}\np-b\tx\towner\tFriday\t2026-03-09T16:05:10Z\tagent\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: row.reason,
    rows: [expect.objectContaining({ id: 'due-cost' }), expect.objectContaining({ id: 'p-b' })],
  });
});

test('it names an id that repeats an earlier row, and keeps the first', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\ndue-cost\tCost table for the alert fan-out\towner\tday 10, before review\t2026-03-09T16:05:10Z\tagent\ndue-cost\tCost table for the alert fan-out\towner\tday 10, before review\t2026-03-09T16:05:10Z\tagent\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: 'the id repeats an earlier row',
    rows: [expect.objectContaining({ id: 'due-cost' })],
  });
});
