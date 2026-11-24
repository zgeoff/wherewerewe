import { expect, test } from 'bun:test';
import { buildMockBriefInput } from './build-mock-brief-input.ts';
import { buildMockItem } from './build-mock-item.ts';
import { buildThreeByteBriefInput } from './build-three-byte-brief-input.ts';

function setupTest() {
  return { buildThreeByteBriefInput };
}

test('it turns each stored text into 3-byte characters, and keeps spaces, ids and results', () => {
  const ctx = setupTest();

  const input = ctx.buildThreeByteBriefInput(
    buildMockBriefInput({
      items: [buildMockItem({ id: 'w-a', kind: 'wait', claim: 'ab cd', extra: { who: 'owner' } })],
      decisions: [{ id: 'd-1', choice: 'x y' }],
    }),
  );

  expect([input.items, input.decisions]).toStrictEqual([
    [expect.objectContaining({ id: 'w-a', claim: '語語 語語', extra: { who: '語語語語語' } })],
    [{ id: 'd-1', choice: '語 語' }],
  ]);
});
