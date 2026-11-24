import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { orderTasks } from './order-tasks.ts';

test('it puts the focus first, then changed, then blocked and owed, then the rest, newest first in each', () => {
  const items = [
    buildMockItem({ id: 'rest-old', written: '2026-03-01T10:00:00Z' }),
    buildMockItem({ id: 'rest-new', written: '2026-03-09T10:00:00Z' }),
    buildMockItem({ id: 'blocked', written: '2026-03-02T10:00:00Z', extra: { blocked_by: 'w-a' } }),
    buildMockItem({ id: 'owed', written: '2026-03-03T10:00:00Z' }),
    buildMockItem({ id: 'both', written: '2026-03-04T10:00:00Z', extra: { blocked_by: 'w-a' } }),
    buildMockItem({ id: 'changed-old', written: '2026-03-05T10:00:00Z' }),
    buildMockItem({ id: 'changed-owed', written: '2026-03-06T10:00:00Z' }),
    buildMockItem({ id: 'focus', written: '2026-03-01T09:00:00Z' }),
    buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
  ];

  const ordered = orderTasks({
    items,
    notes: [
      buildMockNote({ id: 'owed', owed: true }),
      buildMockNote({ id: 'both', owed: true }),
      buildMockNote({ id: 'changed-owed', owed: true }),
    ],
    focus: 'focus',
    changedIDs: new Set(['changed-old', 'changed-owed']),
  });

  expect(ordered.map((item) => item.id)).toStrictEqual([
    'focus',
    'changed-owed',
    'changed-old',
    'both',
    'owed',
    'blocked',
    'rest-new',
    'rest-old',
  ]);
});

test('it puts the later row of items.tsv first on a tie of written', () => {
  const items = ['t-a', 't-b', 't-c'].map((id) => buildMockItem({ id }));
  const ordered = orderTasks({ items, notes: [], focus: null, changedIDs: new Set() });

  expect(ordered.map((item) => item.id)).toStrictEqual(['t-c', 't-b', 't-a']);
});

test('it changes no group for a focus that is not a task, and lists no wait or rule', () => {
  const items = [
    buildMockItem({ id: 't-a', written: '2026-03-01T10:00:00Z' }),
    buildMockItem({ id: 't-b', written: '2026-03-02T10:00:00Z' }),
    buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
    buildMockItem({ id: 'r-a', kind: 'rule' }),
  ];

  const ordered = orderTasks({ items, notes: [], focus: 'w-a', changedIDs: new Set() });

  expect(ordered.map((item) => item.id)).toStrictEqual(['t-b', 't-a']);
});
