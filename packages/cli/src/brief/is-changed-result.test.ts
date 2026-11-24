import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { isChangedResult } from './is-changed-result.ts';

test.each([
  { title: 'differs from the result written', atWrite: 'alive', last: 'gone', expected: true },
  { title: 'equals the result written', atWrite: 'alive', last: 'alive', expected: false },
  { title: 'has no result written', atWrite: null, last: 'gone', expected: false },
  { title: 'has no saved result', atWrite: 'alive', last: null, expected: false },
  { title: 'has an unchecked saved result', atWrite: 'alive', last: 'unchecked', expected: false },
])('it reports a task whose saved result $title as changed: $expected', (row) => {
  const item = buildMockItem({ id: 't-a', atWrite: row.atWrite, last: row.last });

  expect(isChangedResult(item)).toBe(row.expected);
});
