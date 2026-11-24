import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { renderTaskList } from './render-task-list.ts';

test('it lists the tasks in the brief order with a note and an owed note under their task', () => {
  const text = renderTaskList({
    items: [
      buildMockItem({ id: 't-a', written: '2026-03-10T09:43:00Z' }),
      buildMockItem({ id: 't-b', written: '2026-03-10T10:43:00Z' }),
      buildMockItem({ id: 't-c', written: '2026-03-10T08:43:00Z' }),
      buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
    ],
    notes: [
      buildMockNote({ id: 't-a', note: 'Stop the simulator', written: '2026-03-10T10:43:00Z' }),
      buildMockNote({
        id: 't-c',
        owed: true,
        note: 'Turn the flag off',
        written: '2026-03-10T08:43:00Z',
      }),
    ],
    focus: 't-c',
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
  });

  expect(text).toStrictEqual(
    [
      'OPEN (3, max 30)',
      '  t-c         Write the parser  [no check · 3h · owed]',
      '    owed note (3h): Turn the flag off',
      '  t-b         Write the parser  [no check · 1h]',
      '  t-a         Write the parser  [no check · 2h]',
      '    note (1h): Stop the simulator',
      '',
    ].join('\n'),
  );
});

test('it prints a claim of 120 characters and a note of 400 whole', () => {
  const claim = 'c'.repeat(120);
  const note = buildSpacedText(400);

  const text = renderTaskList({
    items: [buildMockItem({ id: 't-a', claim })],
    notes: [buildMockNote({ id: 't-a', note })],
    focus: null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
  });

  const lines = text.split('\n');

  expect({
    claim: lines[1]?.includes(claim),
    note: lines
      .slice(2, -1)
      .map((line) => line.replace(/^ +(?:note \(\d+h\): )?/u, ''))
      .join(' '),
  }).toStrictEqual({ claim: true, note });
});

test('it prints only the heading when no task is open', () => {
  const text = renderTaskList({
    items: [],
    notes: [],
    focus: null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
  });

  expect(text).toStrictEqual('OPEN (0, max 30)\n');
});

test('it lists a task whose saved result differs from the one written second, after the focus', () => {
  const ids = buildMockIDs('task', 8);

  const items = ids.map((id, index) =>
    buildMockItem({
      id,
      check: 'pid:4',
      atWrite: 'alive',
      last: index === 0 ? 'gone' : 'alive',
      written: `2026-03-10T09:${String(10 + index)}:00Z`,
    }),
  );

  const text = renderTaskList({
    items,
    notes: [],
    focus: ids[7] ?? null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
  });

  expect(
    text
      .split('\n')
      .slice(1, 3)
      .map((line) => line.slice(2, 8)),
  ).toStrictEqual(['task08', 'task01']);
});
