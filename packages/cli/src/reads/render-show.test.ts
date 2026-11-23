import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import type { Item, JournalRow, SessionFile } from '../types.ts';
import { renderShow } from './render-show.ts';

function setupTest() {
  const session: SessionFile = {
    format: '1',
    name: 'tide-alerts',
    goal: 'Ship it',
    started: '2026-03-02T08:04:11Z',
    now: null,
    nowNext: null,
    nowSet: null,
    lastWrite: null,
    lastNudge: null,
    importedFrom: null,
  };

  return {
    show: (
      id: string,
      items: readonly Item[],
      rows: readonly JournalRow[],
      closed: ReadonlyMap<string, string> = new Map(),
    ) =>
      renderShow({
        id,
        store: { folder: '/state/tide-alerts', session, items },
        rows,
        closed,
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
      }),
  };
}

test('it shows an open task with a check and two decisions', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'pr-api-77',
    [
      buildMockItem({
        id: 'pr-api-77',
        claim: 'Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07',
        check: 'pr:bosunhq/bosun-api#77',
        atWrite: 'OPEN pending',
        written: '2026-03-10T11:31:00Z',
      }),
    ],
    [
      buildMockJournalRow({ ts: '2026-03-08T10:00:00Z', op: 'task', id: 'pr-api-77' }),
      buildMockJournalRow({
        ts: '2026-03-08T10:05:00Z',
        op: 'decide',
        id: 'd-19',
        text: 'queue the alert in the job, not the request',
        extra: 'on=pr-api-77;who=agent',
      }),
      buildMockJournalRow({ ts: '2026-03-09T10:00:00Z', op: 'set', id: 'pr-api-77' }),
      buildMockJournalRow({
        ts: '2026-03-10T10:48:15Z',
        op: 'ruled-out',
        id: 'd-23',
        text: 'retry a 503 forever',
        extra: 'on=pr-api-77;who=agent',
      }),
      buildMockJournalRow({ ts: '2026-03-10T11:31:00Z', op: 'set', id: 'pr-api-77' }),
    ],
  );

  expect(text).toBe(
    [
      'pr-api-77  task, open since day 7, by agent · check: pr:bosunhq/bosun-api#77',
      '  claim (12m): Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07',
      '  checked now: not checked yet · at write: OPEN pending',
      '  decisions: d-19 queue the alert in the job, not the requ… (day 7) · d-23 ruled out: retry a 503 forever (day 9)',
      '  journal: day 7 task · day 8 set · day 9 set',
      '',
    ].join('\n'),
  );
});

test('it shows a check that has not run as not checked yet at write', () => {
  const ctx = setupTest();

  const text = ctx.show(
    't-a',
    [buildMockItem({ id: 't-a', check: 'pid:4242', written: '2026-03-10T11:43:00Z' })],
    [buildMockJournalRow({ ts: '2026-03-10T11:43:00Z', op: 'task', id: 't-a' })],
  );

  expect(text).toBe(
    [
      't-a  task, open since day 9, by agent · check: pid:4242',
      '  claim (0m): Write the parser',
      '  checked now: not checked yet · at write: not checked yet',
      '  journal: day 9 task',
      '',
    ].join('\n'),
  );
});

test('it shows a wait with who it waits on, and a task with what blocks it', () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({
      id: 'w-apns',
      kind: 'wait',
      claim: 'upload the staging push key',
      extra: { who: 'owner' },
      written: '2026-03-08T09:03:11Z',
    }),
    buildMockItem({
      id: 't-flag',
      claim: 'turn on the flag',
      extra: { blocked_by: 'w-apns' },
      written: '2026-03-10T09:43:00Z',
    }),
  ];

  const rows = [buildMockJournalRow({ ts: '2026-03-08T09:03:11Z', op: 'wait', id: 'w-apns' })];

  expect([ctx.show('w-apns', items, rows), ctx.show('t-flag', items, [])]).toStrictEqual([
    [
      'w-apns  wait, open since day 7, by agent · waits on owner',
      '  what (2d): upload the staging push key',
      '  journal: day 7 wait',
      '',
    ].join('\n'),
    [
      't-flag  task, open since day 9, by agent · blocked by w-apns',
      '  claim (2h): turn on the flag',
      '',
    ].join('\n'),
  ]);
});

test('it shows an approval with who gave it, where, its use and its scope', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'ok-merge',
    [
      buildMockItem({
        id: 'ok-merge',
        kind: 'ok',
        claim: 'merge the alert PRs yourself once CI is green',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api, bosun-app', use: 'standing' },
        written: '2026-03-02T08:09:47Z',
      }),
    ],
    [
      buildMockJournalRow({
        ts: '2026-03-02T08:09:47Z',
        op: 'ok',
        id: 'ok-merge',
        extra: 'use=standing',
      }),
    ],
  );

  expect(text).toBe(
    [
      'ok-merge  approval, open since day 1, by agent',
      '  quote (8d): merge the alert PRs yourself once CI is green',
      '  given by owner in terminal · standing · scope: bosun-api, bosun-app',
      '  journal: day 1 ok',
      '',
    ].join('\n'),
  );
});

test('it shows a closed item with its claim at close, what closed it and the decisions on it', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'pr-app-61',
    [],
    [
      buildMockJournalRow({ ts: '2026-03-04T08:00:00Z', op: 'task', id: 'pr-app-61' }),
      buildMockJournalRow({
        ts: '2026-03-05T08:00:00Z',
        op: 'decide',
        id: 'd-2',
        text: 'ship the settings screen first',
        extra: 'on=pr-app-61;who=owner',
      }),
      buildMockJournalRow({
        ts: '2026-03-09T11:51:00Z',
        op: 'done',
        id: 'pr-app-61',
        text: 'Alert settings screen: in review',
        why: 'merged as 51aa0e2, seen by check',
      }),
    ],
  );

  expect(text).toBe(
    [
      'pr-app-61  closed: done on day 8, by agent',
      '  claim at close: Alert settings screen: in review',
      '  evidence: merged as 51aa0e2, seen by check',
      '  decisions: d-2 ship the settings screen first (day 4)',
      '  journal: day 3 task · day 8 done',
      '',
    ].join('\n'),
  );
});

test.each([
  ['drop', 'dropped', 'reason'],
  ['use', 'used', 'used for'],
])('it words a closed item that %s closed as %s, with %s', (op, closed, label) => {
  const ctx = setupTest();

  const text = ctx.show(
    'x-a',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-04T08:00:00Z',
        op,
        id: 'x-a',
        text: 'the claim',
        why: 'the why',
      }),
    ],
  );

  expect(text.split('\n').slice(0, 3)).toStrictEqual([
    `x-a  closed: ${closed} on day 3, by agent`,
    '  claim at close: the claim',
    `  ${label}: the why`,
  ]);
});

test('it shows a decision that replaces one, and the one that replaces it', () => {
  const ctx = setupTest();

  const rows = [
    buildMockJournalRow({
      ts: '2026-03-05T10:00:00Z',
      op: 'decide',
      id: 'd-1',
      text: 'retry 3 times',
      why: 'the feed flaps',
      extra: 'on=t-a;who=agent',
    }),
    buildMockJournalRow({
      ts: '2026-03-06T10:00:00Z',
      op: 'decide',
      id: 'd-2',
      text: 'retry 5 times',
      why: 'three was not enough',
      extra: 'who=owner;replaces=d-1',
    }),
  ];

  expect([ctx.show('d-1', [], rows), ctx.show('d-2', [], rows)]).toStrictEqual([
    [
      'd-1  decision on t-a · day 4 · by agent',
      '  choice: retry 3 times',
      '  why: the feed flaps',
      '  replaced by: d-2',
      '  journal: day 4 decide',
      '',
    ].join('\n'),
    [
      'd-2  decision · day 5 · by owner',
      '  choice: retry 5 times',
      '  why: three was not enough',
      '  replaces: d-1',
      '  journal: day 5 decide',
      '',
    ].join('\n'),
  ]);
});

test('it shows a ruled-out decision as ruled out', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'd-3',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-05T10:00:00Z',
        op: 'ruled-out',
        id: 'd-3',
        text: 'poll every minute',
        why: 'too slow',
        extra: 'who=agent',
      }),
    ],
  );

  expect(text.split('\n')[0]).toBe('d-3  ruled out · day 4 · by agent');
});

test('it cuts the journal to the last 10 rows with a leading ellipsis', () => {
  const ctx = setupTest();

  const rows = Array.from({ length: 12 }, (_unused, index) =>
    buildMockJournalRow({ ts: '2026-03-04T10:00:00Z', op: `op${String(index + 1)}`, id: 't-a' }),
  );

  const text = ctx.show('t-a', [buildMockItem({ id: 't-a' })], rows);

  expect(text.split('\n').at(-2)).toBe(
    '  journal: … · day 3 op3 · day 3 op4 · day 3 op5 · day 3 op6 · day 3 op7 · day 3 op8 · day 3 op9 · day 3 op10 · day 3 op11 · day 3 op12',
  );
});

test('it lists the open items for an id that no item, decision or journal row has', () => {
  const ctx = setupTest();
  const text = ctx.show('t-zz', [buildMockItem({ id: 't-a' }), buildMockItem({ id: 'w-b' })], []);

  expect(text).toBe('t-zz: no item, decision or journal row has this id. Open items: t-a, w-b.\n');
});

test('it says none when no item is open', () => {
  const ctx = setupTest();
  const text = ctx.show('t-zz', [], []);

  expect(text).toBe('t-zz: no item, decision or journal row has this id. Open items: none.\n');
});

test('it drops the blocked by part once the blocker is no longer open', () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({
      id: 't-flag',
      claim: 'turn on the flag',
      extra: { blocked_by: 'w-apns' },
      written: '2026-03-10T09:43:00Z',
    }),
  ];

  expect(ctx.show('t-flag', items, [])).toBe(
    ['t-flag  task, open since day 9, by agent', '  claim (2h): turn on the flag', ''].join('\n'),
  );
});

test('it drops the blocked by part when the journal closed the blocker but items.tsv still holds it', () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({
      id: 't-flag',
      claim: 'turn on the flag',
      extra: { blocked_by: 'w-apns' },
      written: '2026-03-10T09:43:00Z',
    }),
    buildMockItem({ id: 'w-apns', kind: 'wait', extra: { who: 'sam' } }),
  ];

  expect(ctx.show('t-flag', items, [], new Map([['w-apns', '2026-03-10T10:00:00Z']]))).toBe(
    ['t-flag  task, open since day 9, by agent', '  claim (2h): turn on the flag', ''].join('\n'),
  );
});

test('it lists every decision that replaces a decision', () => {
  const ctx = setupTest();

  const rows = [
    buildMockJournalRow({
      ts: '2026-03-05T10:00:00Z',
      op: 'decide',
      id: 'd-1',
      text: 'retry 3 times',
      why: 'the feed flaps',
    }),
    buildMockJournalRow({
      ts: '2026-03-06T10:00:00Z',
      op: 'decide',
      id: 'd-2',
      text: 'retry 5 times',
      why: 'three was not enough',
      extra: 'who=agent;replaces=d-1',
    }),
    buildMockJournalRow({
      ts: '2026-03-07T10:00:00Z',
      op: 'decide',
      id: 'd-3',
      text: 'retry 4 times',
      why: 'five was too many',
      extra: 'who=agent;replaces=d-1',
    }),
  ];

  expect(ctx.show('d-1', [], rows)).toBe(
    [
      'd-1  decision · day 4 · by agent',
      '  choice: retry 3 times',
      '  why: the feed flaps',
      '  replaced by: d-2, d-3',
      '  journal: day 4 decide',
      '',
    ].join('\n'),
  );
});
