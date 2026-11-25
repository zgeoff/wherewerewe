import { expect, test } from 'bun:test';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { buildMockJournalRow } from './build-mock-journal-row.ts';
import { readCloseModelProblems } from './read-close-model-problems.ts';

function setupTest() {
  const write = buildMockJournalRow({
    ts: '2026-03-10T11:43:00Z',
    op: 'lesson',
    id: 'l-a',
    text: 'Pin the clock',
  });

  const drop = buildMockJournalRow({
    ts: '2026-03-10T11:43:00Z',
    op: 'drop',
    id: 'l-a',
    text: 'Pin the clock',
    extra: 'kind=lesson',
  });

  return {
    write,
    drop,
    read: (fileRows: ReadonlyMap<string, string>, rows: Parameters<typeof formatJournalRows>[0]) =>
      readCloseModelProblems('lesson', fileRows, formatJournalRows(rows), ['l-a']),
  };
}

test.each([
  { title: 'a closed row', held: null, rows: ['write', 'drop'], problems: [] },
  { title: 'an open row', held: 'Pin the clock', rows: ['write'], problems: [] },
  {
    title: 'an open row whose close stopped after its journal row',
    held: 'Pin the clock',
    rows: ['write', 'drop'],
    problems: [],
  },
  {
    title: 'a row that left its file after a write with no close',
    held: null,
    rows: ['write', 'drop', 'write'],
    problems: ['l-a left its file with no close recorded'],
  },
  {
    title: 'a row of a text no write recorded',
    held: 'Seed the table',
    rows: ['write'],
    problems: ['l-a holds a row no write recorded'],
  },
] as const)('it reads $title', (row) => {
  const ctx = setupTest();
  const held: [string, string][] = row.held === null ? [] : [['l-a', row.held]];

  const fileRows = new Map(held);

  const rows = row.rows.map((name) => ctx[name]);

  expect(ctx.read(fileRows, rows)).toStrictEqual([...row.problems]);
});
