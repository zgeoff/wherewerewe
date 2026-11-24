import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import type { PullRequestRow } from '../types.ts';
import { pickCheckSave } from './pick-check-save.ts';
import type { CheckRun } from './types.ts';

function setupTest() {
  return {
    buildRun: (results: Record<string, string>): CheckRun => ({
      results: new Map(Object.entries(results)),
      ran: Object.keys(results).length,
      unchecked: 0,
      reason: null,
      elapsedMs: 100,
    }),
    pickSave: (
      probed: Parameters<typeof pickCheckSave>[0]['probed'],
      results: Record<string, string>,
      fields: { items?: typeof probed; prs?: readonly PullRequestRow[] } = {},
    ) =>
      pickCheckSave({
        probed,
        items: fields.items ?? probed,
        prs: fields.prs ?? [],
        run: setupTest().buildRun(results),
        ts: '2026-03-10T11:43:00Z',
      }),
  };
}

test('it fills at_write and last with the first result, and adds no changed row', () => {
  const ctx = setupTest();
  const items = [buildMockItem({ id: 't-a', check: 'pid:5' })];
  const save = ctx.pickSave(items, { 't-a': 'alive' });

  expect(save).toStrictEqual({
    items: [expect.objectContaining({ id: 't-a', atWrite: 'alive', last: 'alive' })],
    prs: null,
    journal: [],
  });
});

test('it sets last with no row when the result equals at_write after a write', () => {
  const ctx = setupTest();
  const items = [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive' })];
  const save = ctx.pickSave(items, { 't-a': 'alive' });

  expect(save).toStrictEqual({
    items: [expect.objectContaining({ atWrite: 'alive', last: 'alive' })],
    prs: null,
    journal: [],
  });
});

test('it adds a changed row from at_write when last is empty, and from last after that', () => {
  const ctx = setupTest();

  const first = ctx.pickSave([buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive' })], {
    't-a': 'gone',
  });

  const second = ctx.pickSave(
    [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' })],
    { 't-a': 'alive' },
  );

  expect([first.journal, second.journal]).toStrictEqual([
    [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'changed',
        id: 't-a',
        by: 'agent',
        text: 'alive -> gone',
        why: null,
        extra: null,
      },
    ],
    [expect.objectContaining({ id: 't-a', text: 'gone -> alive' })],
  ]);
});

test('it saves nothing for an unchecked result, and keeps the last result', () => {
  const ctx = setupTest();
  const items = [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' })];
  const save = ctx.pickSave(items, { 't-a': 'unchecked' });

  expect(save).toStrictEqual({ items: null, prs: null, journal: [] });
});

test('it leaves an item alone whose check or written time changed since the probe', () => {
  const ctx = setupTest();
  const probed = [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive' })];

  const rewritten = ctx.pickSave(
    probed,
    { 't-a': 'gone' },
    {
      items: [
        buildMockItem({
          id: 't-a',
          check: 'pid:5',
          atWrite: 'alive',
          written: '2026-03-10T11:42:00Z',
        }),
      ],
    },
  );

  const rechecked = ctx.pickSave(
    probed,
    { 't-a': 'gone' },
    {
      items: [buildMockItem({ id: 't-a', check: 'pid:6', atWrite: null })],
    },
  );

  const closed = ctx.pickSave(probed, { 't-a': 'gone' }, { items: [] });

  expect([rewritten, rechecked, closed]).toStrictEqual([
    { items: null, prs: null, journal: [] },
    { items: null, prs: null, journal: [] },
    { items: null, prs: null, journal: [] },
  ]);
});

test('it leaves an item alone that a write of the same check rewrote within the same second', () => {
  const ctx = setupTest();

  const probed = [
    buildMockItem({ id: 't-a', claim: 'old claim', check: 'pid:5', atWrite: 'alive' }),
  ];

  const save = ctx.pickSave(
    probed,
    { 't-a': 'gone' },
    {
      items: [buildMockItem({ id: 't-a', claim: 'new claim', check: 'pid:5', atWrite: 'alive' })],
    },
  );

  expect(save).toStrictEqual({ items: null, prs: null, journal: [] });
});

test.each([
  ['OPEN passing', 'OPEN'],
  ['OPEN failing', 'OPEN'],
  ['MERGED', 'MERGED'],
  ['CLOSED', 'CLOSED'],
] as const)(
  'it sets the state of a prs.tsv row to %s as %s, with the time of the read',
  (result, state) => {
    const ctx = setupTest();

    const save = ctx.pickSave(
      [],
      { 'bosunhq/bosun-app#64': result },
      {
        prs: [
          { ref: 'bosunhq/bosun-app#64', opened: '2026-03-10T08:41:30Z', state: null, seen: null },
        ],
      },
    );

    expect(save.prs).toStrictEqual([
      {
        ref: 'bosunhq/bosun-app#64',
        opened: '2026-03-10T08:41:30Z',
        state,
        seen: '2026-03-10T11:43:00Z',
      },
    ]);
  },
);

test.each(['not found', 'unchecked'])('it leaves a row of prs.tsv as it was for %s', (result) => {
  const ctx = setupTest();

  const row = {
    ref: 'bosunhq/bosun-app#64',
    opened: '2026-03-10T08:41:30Z',
    state: 'OPEN',
    seen: '2026-03-10T10:00:00Z',
  } as const;

  const save = ctx.pickSave([], { 'bosunhq/bosun-app#64': result }, { prs: [row] });

  expect(save.prs).toBeNull();
});
