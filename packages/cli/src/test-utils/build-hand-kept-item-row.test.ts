import { expect, test } from 'bun:test';
import { buildHandKeptItemRow } from './build-hand-kept-item-row.ts';

test('it builds an unchecked task row, with the named cells laid over it', () => {
  expect([
    buildHandKeptItemRow({}),
    buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=owner' }),
  ]).toStrictEqual([
    't-b\ttask\tAnother\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-',
    'w-a\twait\tAnother\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\twho=owner',
  ]);
});
