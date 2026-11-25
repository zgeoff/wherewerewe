import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutRanks } from './cut-ranks.ts';
import type { CutRank } from './cut-ranks.ts';

function setupTest() {
  const text = readFileSync(
    join(import.meta.dir, '..', '..', '..', '..', 'docs', 'design', 'wherewerewe', 'brief.md'),
    'utf8',
  );

  const section = text.slice(text.indexOf('### The cut order'), text.indexOf('## Constraints'));

  // each row of the rank table: its rank number and the text of its Lines cell
  const rows = section.split('\n').flatMap((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    const number = /^(?<rank>\d+)/u.exec(cells[1] ?? '')?.groups?.['rank'];

    return number === undefined ? [] : [{ rank: Number(number), lines: cells[2] ?? '' }];
  });

  const docWords: Readonly<Record<CutRank, RegExp>> = {
    'pull-requests': /^pull request rows and their hint/u,
    promises: /^promises/u,
    where: /^where rows/u,
    tasks: /^task rows other than the item in focus/u,
    'waits-on-others': /^waits on someone else/u,
    decisions: /^decision rows/u,
    lessons: /^lessons/u,
    rules: /^rules/u,
    approval: /^the one-time approval/u,
    'waits-on-owner': /^waits on the owner/u,
    words: /^owner's words/u,
  };

  return { rows: rows.toSorted((first, second) => second.rank - first.rank), docWords };
}

test('it holds the ranks of the cut order table of brief.md, from the first to go to the last', () => {
  const ctx = setupTest();

  expect(ctx.rows.map((row) => row.rank)).toStrictEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  expect(
    cutRanks.map((rank, index) => ctx.docWords[rank].test(ctx.rows[index]?.lines ?? '')),
  ).toStrictEqual(cutRanks.map(() => true));
});
