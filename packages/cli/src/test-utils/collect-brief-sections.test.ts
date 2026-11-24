import { expect, test } from 'bun:test';
import { collectBriefSections } from './collect-brief-sections.ts';

test('it lists the headings that carry a count', () => {
  const brief =
    'GOAL  Ship it\nOPEN (2 of 30)\n  t-a  x\nWAITING (1 of 4)\n  w-a  y\nWrite as you go\n';

  expect(collectBriefSections(brief)).toStrictEqual(['OPEN', 'WAITING']);
});
