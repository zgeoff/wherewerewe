import { expect, test } from 'bun:test';
import { getSteeringWords } from '../test-utils/get-steering-words.ts';
import { formatChainLine } from './format-chain-line.ts';

function setupTest() {
  return { format: formatChainLine };
}

test.each([
  { title: 'no semicolon', claim: 'Ship the chart', note: null, line: null },
  { title: 'one semicolon', claim: 'Ship the chart; then the key', note: null, line: null },
  {
    title: 'a claim of three clauses',
    claim: 'Ship the chart; draw the key; add the tide table',
    note: null,
    line: 't-chart: the claim chains clauses with semicolons, and a row holds one fact, so each clause fits a row of its own.',
  },
  {
    title: 'a note of three clauses',
    claim: null,
    note: 'Axis done; key half done; table not started',
    line: 't-chart: the note chains clauses with semicolons, and a row holds one fact, so each clause fits a row of its own.',
  },
  {
    title: 'both',
    claim: 'a; b; c',
    note: 'd; e; f',
    line: 't-chart: the claim and the note chain clauses with semicolons, and a row holds one fact, so each clause fits a row of its own.',
  },
] as const)('it gives $title the line $line', (row) => {
  const ctx = setupTest();
  const line = ctx.format('t-chart', { claim: row.claim, note: row.note });

  expect({ line, steering: getSteeringWords(line ?? '') }).toStrictEqual({
    line: row.line,
    steering: [],
  });
});
