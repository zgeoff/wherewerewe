import { expect, test } from 'bun:test';
import { readBriefFigure } from './read-brief-figure.ts';

function setupTest() {
  return { readBriefFigure };
}

test.each([
  {
    title: 'a reply that ends with the figure',
    reply: 't-a  task, open, no check. Brief: 147 of 8000 tokens.\n',
    figure: { tokens: 147, limit: 8000 },
  },
  { title: 'a reply with no figure', reply: 'now: t-a.\n', figure: { tokens: null, limit: null } },
])('it reads $title', (row) => {
  const ctx = setupTest();

  expect(ctx.readBriefFigure(row.reply)).toStrictEqual(row.figure);
});
