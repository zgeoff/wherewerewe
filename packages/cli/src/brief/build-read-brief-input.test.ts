import { expect, test } from 'bun:test';
import type { CheckRun } from '../checks/types.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import type { PullRequestRow, Store } from '../types.ts';
import { buildReadBriefInput } from './build-read-brief-input.ts';

function setupTest() {
  return {
    buildStore: (fields: Partial<Store>): Store => ({
      folder: '/state/wherewerewe/tide-alerts',
      session: {
        format: '2',
        grant: null,
        name: 'tide-alerts',
        goal: 'Ship it',
        started: '2026-03-02T08:04:11Z',
        now: null,
        nowNext: null,
        nowSet: null,
        lastWrite: null,
        lastNudge: null,
        importedFrom: null,
      },
      items: [],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
      ...fields,
    }),
    buildRun: (fields: Partial<CheckRun>): CheckRun => ({
      results: new Map(),
      ran: 0,
      unchecked: 0,
      reason: null,
      elapsedMs: 0,
      ...fields,
    }),
    buildRow: (ref: string, state: PullRequestRow['state'] = null): PullRequestRow => ({
      ref,
      opened: '2026-03-10T08:41:30Z',
      state,
      seen: null,
    }),
  };
}

test("it builds the read from this read's results, in items order, with the pull requests it probed", () => {
  const ctx = setupTest();

  const input = buildReadBriefInput(
    ctx.buildStore({
      items: [
        buildMockItem({ id: 't-a', check: 'pid:42', atWrite: 'alive' }),
        buildMockItem({ id: 't-b', check: 'pid:43', atWrite: 'alive' }),
        buildMockItem({ id: 't-c', check: 'pid:44', atWrite: null }),
      ],
      prs: [
        ctx.buildRow('bosunhq/bosun-app#8', 'OPEN'),
        ctx.buildRow('bosunhq/bosun-app#9'),
        ctx.buildRow('bosunhq/bosun-app#10'),
        ctx.buildRow('bosunhq/bosun-app#11'),
      ],
    }),
    {
      run: ctx.buildRun({
        results: new Map([
          ['t-a', 'gone'],
          ['t-b', 'alive'],
          ['t-c', 'gone'],
          ['bosunhq/bosun-app#8', 'OPEN failing'],
          ['bosunhq/bosun-app#9', 'MERGED'],
          ['bosunhq/bosun-app#10', 'unchecked'],
          ['bosunhq/bosun-app#11', 'not found'],
        ]),
        ran: 7,
        unchecked: 1,
        reason: 'offline',
        elapsedMs: 2800,
      }),
      hidden: { kind: 'changed' },
      saved: 'lock-held',
    },
    { nowMs: 1000, sessionFlag: 'tide-alerts', host: 'codex', decisions: [] },
  );

  expect([
    input.changed.map((change) => [change.item.id, change.result]),
    input.pullRequests.map((row) => [row.ref, row.result]),
    input.checks,
    input.resultsNotSaved,
    input.nowHidden,
    input.sessionFlag,
    input.host,
  ]).toStrictEqual([
    [['t-a', 'gone']],
    [
      ['bosunhq/bosun-app#8', 'OPEN failing'],
      ['bosunhq/bosun-app#10', 'unchecked'],
    ],
    { kind: 'ran', count: 7, seconds: 2.8, unchecked: { count: 1, reason: 'offline' } },
    'lock-held',
    { kind: 'changed' },
    'tide-alerts',
    'codex',
  ]);
});

test('it never shows a pull request row that an item names', () => {
  const ctx = setupTest();

  const input = buildReadBriefInput(
    ctx.buildStore({
      items: [buildMockItem({ id: 't-a', check: 'pr:bosunhq/bosun-app#8' })],
      prs: [ctx.buildRow('bosunhq/bosun-app#8', 'OPEN')],
    }),
    {
      run: ctx.buildRun({ results: new Map([['bosunhq/bosun-app#8', 'OPEN passing']]), ran: 1 }),
      hidden: null,
      saved: null,
    },
    { nowMs: 1000, sessionFlag: null, host: 'codex', decisions: [] },
  );

  expect(input.pullRequests).toStrictEqual([]);
});

test('it reports no checks in a read when no probe ran, and no unchecked part when every probe read', () => {
  const ctx = setupTest();
  const context = { nowMs: 1000, sessionFlag: null, host: 'codex', decisions: [] } as const;
  const parts = { hidden: null, saved: null };

  const none = buildReadBriefInput(
    ctx.buildStore({}),
    { ...parts, run: ctx.buildRun({}) },
    context,
  );

  const ran = buildReadBriefInput(
    ctx.buildStore({}),
    { ...parts, run: ctx.buildRun({ ran: 3, elapsedMs: 120 }) },
    context,
  );

  expect([none.checks, ran.checks]).toStrictEqual([
    { kind: 'none' },
    { kind: 'ran', count: 3, seconds: 0.12, unchecked: null },
  ]);
});
