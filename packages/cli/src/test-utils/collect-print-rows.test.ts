import { expect, test } from 'bun:test';
import { collectPrintRows } from './collect-print-rows.ts';

function setupTest() {
  return { collect: collectPrintRows };
}

test('it opens a row at each line that matches and keeps the lines after it with it', () => {
  const ctx = setupTest();

  expect(ctx.collect('HEAD\nday 1 a\n   more\nday 2 b\n', /^day /u)).toStrictEqual([
    'day 1 a\n   more',
    'day 2 b\n',
  ]);
});

test('it gives the whole text as one row when no start is given', () => {
  const ctx = setupTest();

  expect(ctx.collect('a\nb\n', null)).toStrictEqual(['a\nb\n']);
});
