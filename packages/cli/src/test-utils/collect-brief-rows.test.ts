import { expect, test } from 'bun:test';
import { collectBriefRows } from './collect-brief-rows.ts';

test('it collects the lines that match the pattern, in order', () => {
  expect(collectBriefRows('A\n  r-a  x\n  r-b  y\n', /^ {2}r-/u)).toStrictEqual([
    '  r-a  x',
    '  r-b  y',
  ]);
});
