import { expect, test } from 'bun:test';
import { collectBriefRows } from './collect-brief-rows.ts';

function setupTest() {
  return { collectBriefRows };
}

test('it collects the lines that match the pattern, in order', () => {
  const ctx = setupTest();

  expect(ctx.collectBriefRows('A\n  r-a  x\n  r-b  y\n', /^ {2}r-/u)).toStrictEqual([
    '  r-a  x',
    '  r-b  y',
  ]);
});
