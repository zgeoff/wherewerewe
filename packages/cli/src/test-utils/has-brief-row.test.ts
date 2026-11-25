import { expect, test } from 'bun:test';
import { hasBriefRow } from './has-brief-row.ts';

function setupTest() {
  return { hasBriefRow };
}

test('it finds a row by the mark that starts its line', () => {
  const ctx = setupTest();

  expect([
    ctx.hasBriefRow('RULES (1)\n  r-a  Claim\n', 'r-a'),
    ctx.hasBriefRow('RULES (1)\n  r-a  Claim\n', 'r-b'),
  ]).toStrictEqual([true, false]);
});
