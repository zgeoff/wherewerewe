import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { isBlockedTask } from './is-blocked-task.ts';

test.each([
  { title: 'an open wait', blocker: buildMockItem({ id: 'w-a', kind: 'wait' }), expected: true },
  { title: 'an open task', blocker: buildMockItem({ id: 'w-a' }), expected: true },
  { title: 'an open rule', blocker: buildMockItem({ id: 'w-a', kind: 'rule' }), expected: false },
  { title: 'no open item', blocker: buildMockItem({ id: 'other', kind: 'wait' }), expected: false },
])('it reports a task blocked by $title as blocked: $expected', (row) => {
  const task = buildMockItem({ id: 't-a', extra: { blocked_by: 'w-a' } });

  expect(isBlockedTask(task, [task, row.blocker])).toBe(row.expected);
});
