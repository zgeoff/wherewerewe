import { expect, test } from 'bun:test';
import { hasBriefRow } from './has-brief-row.ts';

test('it finds a row by the mark that starts its line', () => {
  expect([
    hasBriefRow('RULES (1)\n  r-a  Claim\n', 'r-a'),
    hasBriefRow('RULES (1)\n  r-a  Claim\n', 'r-b'),
  ]).toStrictEqual([true, false]);
});
