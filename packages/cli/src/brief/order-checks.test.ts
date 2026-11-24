import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildWorstCaseBriefInput } from '../test-utils/build-worst-case-brief-input.ts';
import { orderChecks } from './order-checks.ts';
import { orderOpenTasks } from './order-open-tasks.ts';

function setupTest() {
  return { orderChecks };
}

test('it starts the focus, the owner waits, the other waits, every task, the where items, then the pull requests', () => {
  const ctx = setupTest();

  const tasks = Array.from({ length: 30 }, (_value, index) =>
    buildMockItem({
      id: `t-${String(index).padStart(2, '0')}`,
      check: 'pid:4',
      written: `2026-03-10T10:${String(index).padStart(2, '0')}:00Z`,
    }),
  );

  const items = [
    buildMockItem({ id: 'w-other', kind: 'wait', check: 'pid:4', extra: { who: 'tidekit team' } }),
    buildMockItem({ id: 'w-owner', kind: 'wait', check: 'pid:4', extra: { who: 'owner' } }),
    ...tasks,
    buildMockItem({ id: 'wh-tree', kind: 'where', check: 'path:/srv/tide' }),
  ];

  const ordered = ctx.orderChecks({
    items,
    notes: [],
    focus: 't-03',
    pullRequests: [{ ref: 'acme/tool#1' }],
  });

  const taskOrder = tasks.toReversed().map((task) => task.id);

  expect(ordered).toStrictEqual([
    't-03',
    'w-owner',
    'w-other',
    ...taskOrder.filter((id) => id !== 't-03'),
    'wh-tree',
    'acme/tool#1',
  ]);
});

test('it starts the tasks in the order the brief prints them', () => {
  const ctx = setupTest();
  const input = buildWorstCaseBriefInput({ host: 'claude', taskCount: 30 });

  const ordered = ctx.orderChecks({
    items: input.items,
    notes: input.notes,
    focus: input.session.now,
    pullRequests: [],
  });

  const taskIDs = new Set(buildMockIDs('task', 30));

  expect(ordered.filter((id) => taskIDs.has(id))).toStrictEqual(
    orderOpenTasks(input).map((item) => item.id),
  );
});

test('it gives the same order for every host and limit', () => {
  const ctx = setupTest();

  const orders = (['claude', 'codex', null] as const).map((host) => {
    const input = buildWorstCaseBriefInput({ host, taskCount: 30 });

    return ctx.orderChecks({
      items: input.items,
      notes: input.notes,
      focus: input.session.now,
      pullRequests: input.pullRequests,
    });
  });

  expect(orders[1]).toStrictEqual(orders[0]);
  expect(orders[2]).toStrictEqual(orders[0]);
});

test('it leaves out an item with no check and lists each item once', () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({ id: 't-a', check: 'pid:4' }),
    buildMockItem({ id: 't-b' }),
    buildMockItem({ id: 'w-a', kind: 'wait', check: 'pid:4', extra: { who: 'owner' } }),
  ];

  const ordered = ctx.orderChecks({ items, notes: [], focus: 't-a', pullRequests: [] });

  expect(ordered).toStrictEqual(['t-a', 'w-a']);
});

test('it starts the waits before the where items, whatever items.tsv holds', () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({ id: 'wh-tree', kind: 'where', check: 'path:/srv/tide' }),
    buildMockItem({ id: 'w-keys', kind: 'wait', check: 'pid:4242' }),
  ];

  expect(ctx.orderChecks({ items, notes: [], focus: null, pullRequests: [] })).toStrictEqual([
    'w-keys',
    'wh-tree',
  ]);
});
