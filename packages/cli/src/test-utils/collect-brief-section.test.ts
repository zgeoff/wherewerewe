import { expect, test } from 'bun:test';
import { collectBriefSection } from './collect-brief-section.ts';

function setupTest() {
  return { collect: collectBriefSection };
}

test('it collects a heading and the indented lines under it, and stops at the next heading', () => {
  const ctx = setupTest();

  expect(
    ctx.collect('GOAL  x\nWORDS (1)\n  w-a  y\n    wrapped\nNOW  none\n', 'WORDS'),
  ).toStrictEqual(['WORDS (1)', '  w-a  y', '    wrapped']);
});

test('it gives no line for a heading the text lacks', () => {
  const ctx = setupTest();

  expect(ctx.collect('GOAL  x\n', 'WORDS')).toStrictEqual([]);
});
