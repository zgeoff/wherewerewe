import { expect, test } from 'bun:test';
import { toSortedBy } from './to-sorted-by.ts';

function setupTest() {
  return { toSortedBy };
}

test('it orders the rows by key and keeps a repeated row', () => {
  const ctx = setupTest();
  const sorted = ctx.toSortedBy([{ id: 't-b' }, { id: 't-a' }, { id: 't-b' }], (row) => row.id);

  expect(sorted).toStrictEqual([{ id: 't-a' }, { id: 't-b' }, { id: 't-b' }]);
});
