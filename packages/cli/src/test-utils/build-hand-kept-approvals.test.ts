import { expect, test } from 'bun:test';
import { buildHandKeptApprovals } from './build-hand-kept-approvals.ts';

test('it builds one approval row for each extra token', () => {
  const store = buildHandKeptApprovals(['once', 'standing']);

  expect(store.items.rows.map((row) => row.cells.at(0))).toStrictEqual(['ok-0', 'ok-1']);
});
