import { expect, test } from 'bun:test';
import { buildMockBriefInput } from './build-mock-brief-input.ts';
import { buildMockItem } from './build-mock-item.ts';
import { collectMissingRows } from './collect-missing-rows.ts';

function setupTest() {
  return { collect: collectMissingRows };
}

test('it names each item and decision whose row the brief lacks, and no other', () => {
  const ctx = setupTest();

  const input = buildMockBriefInput({
    items: [buildMockItem({ id: 't-a' }), buildMockItem({ id: 't-b' })],
    decisions: [
      { id: 'd-3', choice: 'x' },
      { id: 'd-2', choice: 'y' },
      { id: 'd-1', choice: 'z' },
      { id: 'd-0', choice: 'w' },
    ],
  });

  expect(ctx.collect(input, 'OPEN (2)\n  t-a  claim\n  d-3  x\n  d-1  z\n')).toStrictEqual([
    't-b',
    'd-2',
  ]);
});
