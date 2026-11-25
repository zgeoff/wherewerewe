import { expect, test } from 'bun:test';
import { lessonsHeader } from './constants.ts';
import { formatLessonsFile } from './format-lessons-file.ts';
import { parseLessonsFile } from './parse-lessons-file.ts';

function setupTest() {
  return { parse: parseLessonsFile, format: formatLessonsFile, header: lessonsHeader };
}

test('it parses the example row of store.md and writes it back as it read it', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\nl-seed\tReseed the staging alerts table before alerts-e2e\tA stale row made alerts-e2e pass on day 6 while no alert fired\t2026-03-07T15:20:44Z\tagent\n`;

  const row = {
    id: 'l-seed',
    text: 'Reseed the staging alerts table before alerts-e2e',
    why: 'A stale row made alerts-e2e pass on day 6 while no alert fired',
    written: '2026-03-07T15:20:44Z',
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
    text: 'l-seed\tReseed the staging alerts table before alerts-e2e\tA stale row made alerts-e2e pass on day 6 while no alert fired\t2026-03-07T15:20:44Z\tagent\n',
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
    line: `L-1\tx\ty\t2026-03-07T15:20:44Z\tagent`,
    reason: 'the id is not an item id',
  },
  {
    title: 'an empty text',
    line: `l-a\t\ty\t2026-03-07T15:20:44Z\tagent`,
    reason: 'the text is empty, longer than 120 characters or not one line',
  },
  {
    title: 'a text of 121 characters',
    line: `l-a\t${'x'.repeat(121)}\ty\t2026-03-07T15:20:44Z\tagent`,
    reason: 'the text is empty, longer than 120 characters or not one line',
  },
  {
    title: 'an empty why',
    line: `l-a\tx\t\t2026-03-07T15:20:44Z\tagent`,
    reason: 'the why is empty, longer than 200 characters or not one line',
  },
  {
    title: 'a why of 201 characters',
    line: `l-a\tx\t${'y'.repeat(201)}\t2026-03-07T15:20:44Z\tagent`,
    reason: 'the why is empty, longer than 200 characters or not one line',
  },
  {
    title: 'a written time with no Z',
    line: `l-a\tx\ty\t2026-03-07T15:20:44\tagent`,
    reason: 'the written time is not an ISO 8601 UTC time to the second, ending in Z',
  },
  {
    title: 'a by of hook',
    line: `l-a\tx\ty\t2026-03-07T15:20:44Z\thook`,
    reason: 'the by column is not agent or owner',
  },
  {
    title: 'a row of 4 columns',
    line: `l-a\tx\ty\t2026-03-07T15:20:44Z`,
    reason: 'expected 5 tab-separated columns, found 4',
  },
  {
    title: 'a row of 6 columns',
    line: `l-a\tx\ty\t2026-03-07T15:20:44Z\tagent\textra`,
    reason: 'expected 5 tab-separated columns, found 6',
  },
])('it leaves out $title, names it at line 3 and keeps the row before it', (row) => {
  const ctx = setupTest();
  const text = `${ctx.header}\nl-seed\tReseed the staging alerts table before alerts-e2e\tA stale row made alerts-e2e pass on day 6 while no alert fired\t2026-03-07T15:20:44Z\tagent\n${row.line}\nl-b\tx\ty\t2026-03-07T15:20:44Z\tagent\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: row.reason,
    rows: [expect.objectContaining({ id: 'l-seed' }), expect.objectContaining({ id: 'l-b' })],
  });
});

test('it names an id that repeats an earlier row, and keeps the first', () => {
  const ctx = setupTest();
  const text = `${ctx.header}\nl-seed\tReseed the staging alerts table before alerts-e2e\tA stale row made alerts-e2e pass on day 6 while no alert fired\t2026-03-07T15:20:44Z\tagent\nl-seed\tReseed the staging alerts table before alerts-e2e\tA stale row made alerts-e2e pass on day 6 while no alert fired\t2026-03-07T15:20:44Z\tagent\n`;

  expect(ctx.parse(text)).toStrictEqual({
    kind: 'broken',
    line: 3,
    reason: 'the id repeats an earlier row',
    rows: [expect.objectContaining({ id: 'l-seed' })],
  });
});
