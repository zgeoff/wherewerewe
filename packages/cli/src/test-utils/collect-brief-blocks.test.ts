import { expect, test } from 'bun:test';
import { briefFooter } from '../brief/join-brief.ts';
import { collectBriefBlocks } from './collect-brief-blocks.ts';

function setupTest() {
  return { collect: collectBriefBlocks };
}

test('it sums the bytes of each block, counts a 3-byte character as 3 and leaves out a missing block as 0', () => {
  const ctx = setupTest();

  const brief = [
    'tide · day 9',
    '  second header line',
    'GOAL  語',
    '  more',
    'WORDS (1, max 8)',
    '  w-a',
    briefFooter,
    '',
  ].join('\n');

  expect(ctx.collect(brief).filter((block) => block.bytes > 0)).toStrictEqual([
    { label: 'header', bytes: 35 },
    { label: 'goal', bytes: 17 },
    { label: "owner's words", bytes: 23 },
    { label: 'footer', bytes: 98 },
  ]);
});
