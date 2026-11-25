import { expect, test } from 'bun:test';
import { textLimits } from '../rules/text-limits.ts';
import { wordsHeader } from './constants.ts';
import { formatWordsFile } from './format-words-file.ts';
import { parseWordsFile } from './parse-words-file.ts';

function setupTest() {
  return { parse: parseWordsFile, format: formatWordsFile, header: wordsHeader };
}

test('it parses the example row of store.md and writes it back as it read it', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\nw-plain\tPlain words in every reply; I would rather read three short sentences than one clever one\tchat\t2026-03-04T09:30:00Z\tagent\n`;

  const row = {
    id: 'w-plain',
    words:
      'Plain words in every reply; I would rather read three short sentences than one clever one',
    where: 'chat',
    written: '2026-03-04T09:30:00Z',
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
    text: 'w-plain\tPlain words in every reply; I would rather read three short sentences than one clever one\tchat\t2026-03-04T09:30:00Z\tagent\n',
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
    line: `W-1\tx\tchat\t2026-03-04T09:30:00Z\tagent`,
    reason: 'the id is not an item id',
  },
  {
    title: 'empty words',
    line: `w-a\t\tchat\t2026-03-04T09:30:00Z\tagent`,
    reason: 'the words are empty, longer than 300 characters or not one line',
  },
  {
    title: 'words of 301 characters',
    line: `w-a\t${'x'.repeat(301)}\tchat\t2026-03-04T09:30:00Z\tagent`,
    reason: 'the words are empty, longer than 300 characters or not one line',
  },
  {
    title: 'an empty where',
    line: `w-a\tx\t\t2026-03-04T09:30:00Z\tagent`,
    reason: `the where is empty, longer than ${String(textLimits.wordsWhere)} characters, not one line or holds ; or =`,
  },
  {
    title: 'a where one character over its limit',
    line: `w-a\tx\t${'c'.repeat(textLimits.wordsWhere + 1)}\t2026-03-04T09:30:00Z\tagent`,
    reason: `the where is empty, longer than ${String(textLimits.wordsWhere)} characters, not one line or holds ; or =`,
  },
  {
    title: 'a where that holds a semicolon',
    line: `w-a\tx\ta;b\t2026-03-04T09:30:00Z\tagent`,
    reason: `the where is empty, longer than ${String(textLimits.wordsWhere)} characters, not one line or holds ; or =`,
  },
  {
    title: 'a written time with no Z',
    line: `w-a\tx\tchat\t2026-03-04T09:30:00\tagent`,
    reason: 'the written time is not an ISO 8601 UTC time to the second, ending in Z',
  },
  {
    title: 'a by of hook',
    line: `w-a\tx\tchat\t2026-03-04T09:30:00Z\thook`,
    reason: 'the by column is not agent or owner',
  },
  {
    title: 'a row of 4 columns',
    line: `w-a\tx\tchat\t2026-03-04T09:30:00Z`,
    reason: 'expected 5 tab-separated columns, found 4',
  },
])('it leaves out $title, names it at line 3 and keeps the row before it', (row) => {
  const ctx = setupTest();
  const text = `${ctx.header}\nw-plain\tPlain words in every reply; I would rather read three short sentences than one clever one\tchat\t2026-03-04T09:30:00Z\tagent\n${row.line}\nw-b\tx\tchat\t2026-03-04T09:30:00Z\towner\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: row.reason,
    rows: [expect.objectContaining({ id: 'w-plain' }), expect.objectContaining({ id: 'w-b' })],
  });
});

test('it names an id that repeats an earlier row, and keeps the first', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\nw-plain\tPlain words in every reply; I would rather read three short sentences than one clever one\tchat\t2026-03-04T09:30:00Z\tagent\nw-plain\tPlain words in every reply; I would rather read three short sentences than one clever one\tchat\t2026-03-04T09:30:00Z\tagent\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: 'the id repeats an earlier row',
    rows: [expect.objectContaining({ id: 'w-plain' })],
  });
});
