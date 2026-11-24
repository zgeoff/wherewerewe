import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildWorstCaseBriefInput } from '../test-utils/build-worst-case-brief-input.ts';
import { orderChecks } from './order-checks.ts';
import { pickPrintedTaskIDs } from './render-brief.ts';

test.each([
  { host: 'codex', shown: 5 },
  { host: 'claude', shown: 14 },
] as const)('it starts the printed rows first for the $host budget', (row) => {
  const input = buildWorstCaseBriefInput({ host: row.host, taskCount: 30 });
  const printed = pickPrintedTaskIDs(input);
  const taskIDs = buildMockIDs('task', 30);
  const focus = taskIDs[0] ?? '';
  const rest = taskIDs.slice(1).toReversed();

  const ordered = orderChecks({
    items: input.items,
    notes: input.notes,
    focus,
    printedTaskIDs: printed,
    pullRequests: [{ ref: 'acme/tool#1' }, { ref: 'acme/tool#2' }],
  });

  expect(ordered).toStrictEqual([
    focus,
    ...rest.slice(0, row.shown - 1),
    ...buildMockIDs('wait', 4),
    ...buildMockIDs('here', 4),
    'acme/tool#1',
    'acme/tool#2',
    ...rest.slice(row.shown - 1),
  ]);

  expect(printed).toHaveLength(row.shown);
});

test('it leaves out an item with no check and lists each item once', () => {
  const items = [
    buildMockItem({ id: 't-a', check: 'pid:4' }),
    buildMockItem({ id: 't-b' }),
    buildMockItem({ id: 'w-a', kind: 'wait', check: 'pid:4', extra: { who: 'owner' } }),
  ];

  const ordered = orderChecks({
    items,
    notes: [],
    focus: 't-a',
    printedTaskIDs: ['t-a', 't-b'],
    pullRequests: [],
  });

  expect(ordered).toStrictEqual(['t-a', 'w-a']);
});
