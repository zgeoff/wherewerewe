import { expect, test } from 'bun:test';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import type { Grant, Item, JournalRow, Note, SessionFile } from '../types.ts';
import { renderShow } from './render-show.ts';

interface ShowOptions {
  readonly closed?: ReadonlyMap<string, string>;
  readonly notes?: readonly Note[];
  readonly grant?: Grant;
  readonly checkNow?: { readonly result: string; readonly failing: readonly string[] };
}

function setupTest() {
  const session: SessionFile = {
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
  };

  return {
    show: (
      id: string,
      items: readonly Item[],
      rows: readonly JournalRow[],
      options: ShowOptions = {},
    ) =>
      renderShow({
        id,
        store: {
          folder: '/state/tide-alerts',
          session: { ...session, grant: options.grant ?? null },
          items,
          ownerNotes: [],
          notes: options.notes ?? [],
          notesUnread: null,
          prs: [],
          prsUnread: null,
          ownerUnread: null,
        },
        rows,
        closed: options.closed ?? new Map(),
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        checkNow: options.checkNow ?? null,
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
    { checkNow: { result: 'OPEN failing', failing: ['oxlint'] } },
  );

  expect(text).toBe(
    [
      'pr-api-77  task, open since day 7, by agent · check: pr:bosunhq/bosun-api#77',
      '  claim (12m): Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07',
      '  checked now: OPEN failing (oxlint) · at write: OPEN pending',
      '  decisions: d-19 queue the alert in the job, not the requ… (day 7) · d-23 ruled out: retry a 503 forever (day 9)',
      '  journal: day 7 task · day 8 set · day 9 set',
      '',
    ].join('\n'),
  );
});

test('it shows an unchecked result now, and not checked yet at write', () => {
  const ctx = setupTest();

  const text = ctx.show(
    't-a',
    [buildMockItem({ id: 't-a', check: 'pid:4242', written: '2026-03-10T11:43:00Z' })],
    [buildMockJournalRow({ ts: '2026-03-10T11:43:00Z', op: 'task', id: 't-a' })],
    { checkNow: { result: 'unchecked', failing: [] } },
  );

  expect(text).toBe(
    [
      't-a  task, open since day 9, by agent · check: pid:4242',
      '  claim (0m): Write the parser',
      '  checked now: unchecked · at write: not checked yet',
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

test('it shows an approval with who gave it, where and its scope', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'ok-merge',
    [
      buildMockItem({
        id: 'ok-merge',
        kind: 'ok',
        claim: 'merge the alert PRs yourself once CI is green',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api, bosun-app' },
        written: '2026-03-02T08:09:47Z',
      }),
    ],
    [
      buildMockJournalRow({
        ts: '2026-03-02T08:09:47Z',
        op: 'ok',
        id: 'ok-merge',
      }),
    ],
  );

  expect(text).toBe(
    [
      'ok-merge  approval, open since day 1, by agent',
      '  quote (8d): merge the alert PRs yourself once CI is green',
      '  given by owner in terminal · scope: bosun-api, bosun-app',
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

  expect(
    ctx.show('t-flag', items, [], { closed: new Map([['w-apns', '2026-03-10T10:00:00Z']]) }),
  ).toBe(
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

test('it prints the note after the claim, wrapped with each further line indented 4', () => {
  const ctx = setupTest();
  const note = [...Array.from({ length: 4 }, () => 'w'.repeat(81)), 'v'.repeat(30)].join(' ');

  const text = ctx.show(
    't-a',
    [buildMockItem({ id: 't-a', claim: 'Wire it', written: '2026-03-10T11:31:00Z' })],
    [buildMockJournalRow({ ts: '2026-03-10T10:00:00Z', op: 'task', id: 't-a' })],
    { notes: [{ id: 't-a', owed: false, written: '2026-03-10T10:43:00Z', note }] },
  );

  expect(text.split('\n').slice(1, 7)).toStrictEqual([
    '  claim (12m): Wire it',
    `  note (1h): ${'w'.repeat(81)}`,
    `    ${'w'.repeat(81)}`,
    `    ${'w'.repeat(81)}`,
    `    ${'w'.repeat(81)}`,
    `    ${'v'.repeat(30)}`,
  ]);
});

test('it labels an owed note and prints a short note on one line', () => {
  const ctx = setupTest();

  const text = ctx.show(
    't-a',
    [buildMockItem({ id: 't-a', claim: 'Wire it', written: '2026-03-10T11:31:00Z' })],
    [
      buildMockJournalRow({ ts: '2026-03-10T10:00:00Z', op: 'task', id: 't-a' }),
      buildMockJournalRow({ ts: '2026-03-10T10:43:00Z', op: 'note', id: 't-a' }),
    ],
    {
      notes: [
        { id: 't-a', owed: true, written: '2026-03-10T10:43:00Z', note: 'Stop the simulator' },
      ],
    },
  );

  expect(text).toBe(
    [
      't-a  task, open since day 9, by agent',
      '  claim (12m): Wire it',
      '  owed note (1h): Stop the simulator',
      '  journal: day 9 task · day 9 note',
      '',
    ].join('\n'),
  );
});

test('it prints no note line for an item with no note', () => {
  const ctx = setupTest();

  const text = ctx.show(
    't-a',
    [buildMockItem({ id: 't-a', claim: 'Wire it', written: '2026-03-10T11:31:00Z' })],
    [buildMockJournalRow({ ts: '2026-03-10T10:00:00Z', op: 'task', id: 't-a' })],
    { notes: [{ id: 't-b', owed: false, written: '2026-03-10T10:43:00Z', note: 'Not this item' }] },
  );

  expect(text).not.toInclude('note (');
});

test('it prints show grant with a scope and three groups, after the reading alone was replaced', () => {
  const ctx = setupTest();

  const grantText =
    'may: water the beds • mow the lawn · not: prune the roses · never: dig up the roses • spray the hives · scope: in the east garden';

  const grantReading =
    'covers watering and mowing in the east garden with the hose from the shed; kept back: pruning, the roses and the hives';

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: grantText,
        why: 'covers watering',
        extra: 'where=chat',
      }),
      buildMockJournalRow({
        ts: '2026-03-10T11:31:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: grantText,
        why: grantReading,
        extra: 'where=chat;reading=1',
      }),
    ],
    {
      grant: {
        may: ['water the beds', 'mow the lawn'],
        not: ['prune the roses'],
        never: ['dig up the roses', 'spray the hives'],
        scope: 'in the east garden',
        reading: grantReading,
        where: 'chat',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect(text).toBe(
    [
      'grant  from the owner in chat · in the east garden',
      '  words (7d), set on day 2 by agent:',
      '  may    • water the beds',
      '         • mow the lawn',
      '  not    • prune the roses',
      '  never  • dig up the roses  • spray the hives',
      '  reading (12m), set on day 9: covers watering and mowing in the east garden with the hose from the',
      '    shed; kept back: pruning, the roses and the hives',
      '  journal: day 2 grant · day 9 grant',
      '',
    ].join('\n'),
  );
});

test('it prints show grant with no scope and one group, the heading and the reading kept', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'owner',
        text: 'may: water the beds',
        why: 'covers watering',
        extra: 'where=terminal',
      }),
    ],
    {
      grant: {
        may: ['water the beds'],
        not: [],
        never: [],
        scope: null,
        reading: 'covers watering',
        where: 'terminal',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect(text).toBe(
    [
      'grant  from the owner in terminal',
      '  words (7d), set on day 2 by owner:',
      '  may    • water the beds',
      '  reading (7d), set on day 2: covers watering',
      '  journal: day 2 grant',
      '',
    ].join('\n'),
  );
});

test('it prints show grant for a grant of only a not bullet', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'not: replant the north beds before the soil report is in',
        why: 'covers nothing yet',
        extra: 'where=chat',
      }),
    ],
    {
      grant: {
        may: [],
        not: ['replant the north beds before the soil report is in'],
        never: [],
        scope: null,
        reading: 'covers nothing yet',
        where: 'chat',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect(
    text.split('\n').filter((line) => /^(?:grant|  (?:may|not|never|reading|journal))/u.test(line)),
  ).toStrictEqual([
    'grant  from the owner in chat',
    '  not    • replant the north beds before the soil report is in',
    '  reading (7d), set on day 2: covers nothing yet',
    '  journal: day 2 grant',
  ]);
});

test('it names the owner as the one who set the words when the agent replaces the reading in the same second', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'owner',
        text: 'may: Merge it yourself.',
        why: 'covers merges',
        extra: 'where=chat',
      }),
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'may: Merge it yourself.',
        why: 'covers merges and deploys',
        extra: 'where=chat;reading=1',
      }),
    ],
    {
      grant: {
        may: ['Merge it yourself.'],
        not: [],
        never: [],
        scope: null,
        reading: 'covers merges and deploys',
        where: 'chat',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect([
    text.split('\n').at(1),
    text.split('\n').find((line) => line.startsWith('  reading (')),
  ]).toStrictEqual([
    '  words (7d), set on day 2 by owner:',
    '  reading (7d), set on day 2: covers merges and deploys',
  ]);
});

test('it names the agent as the one who set the words when the agent writes the same words in the same second', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'owner',
        text: 'may: Merge it yourself.',
        why: 'covers merges',
        extra: 'where=chat',
      }),
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'may: Merge it yourself.',
        why: 'covers merges and deploys',
        extra: 'where=chat',
      }),
    ],
    {
      grant: {
        may: ['Merge it yourself.'],
        not: [],
        never: [],
        scope: null,
        reading: 'covers merges and deploys',
        where: 'chat',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect([
    text.split('\n').at(1),
    text.split('\n').find((line) => line.startsWith('  reading (')),
  ]).toStrictEqual([
    '  words (7d), set on day 2 by agent:',
    '  reading (7d), set on day 2: covers merges and deploys',
  ]);
});

test('it names the writer of the newest words when an earlier write in the same second held other words', () => {
  const ctx = setupTest();

  const text = ctx.show(
    'grant',
    [],
    [
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'owner',
        text: 'may: Merge it yourself.',
        why: 'covers merges',
        extra: 'where=chat',
      }),
      buildMockJournalRow({
        ts: '2026-03-03T09:00:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'may: Deploy it yourself.',
        why: 'covers deploys',
        extra: 'where=chat',
      }),
    ],
    {
      grant: {
        may: ['Deploy it yourself.'],
        not: [],
        never: [],
        scope: null,
        reading: 'covers deploys',
        where: 'chat',
        set: '2026-03-03T09:00:00Z',
      },
    },
  );

  expect([
    text.split('\n').at(1),
    text.split('\n').find((line) => line.startsWith('  reading (')),
  ]).toStrictEqual([
    '  words (7d), set on day 2 by agent:',
    '  reading (7d), set on day 2: covers deploys',
  ]);
});

test.each([
  [
    'other words',
    {
      ts: '2026-03-04T09:00:00Z',
      text: 'may: Deploy it yourself.',
      why: 'covers merges',
      extra: 'where=chat',
    },
  ],
  [
    'the same words and a new reading',
    {
      ts: '2026-03-04T09:00:00Z',
      text: 'may: Merge it yourself.',
      why: 'covers deploys',
      extra: 'where=chat',
    },
  ],
  [
    'the same words and a new reading in the same second',
    {
      ts: '2026-03-03T09:00:00Z',
      text: 'may: Merge it yourself.',
      why: 'covers deploys',
      extra: 'where=chat',
    },
  ],
  [
    'the same words and reading from a new where',
    {
      ts: '2026-03-04T09:00:00Z',
      text: 'may: Merge it yourself.',
      why: 'covers merges',
      extra: 'where=terminal',
    },
  ],
  [
    'the same words and reading as a row with no reading=1',
    {
      ts: '2026-03-04T09:00:00Z',
      text: 'may: Merge it yourself.',
      why: 'covers merges',
      extra: 'where=chat',
    },
  ],
])(
  'it dates and names the grant from the rows it holds when a later write of %s stopped after its journal row',
  (_name, stopped) => {
    const ctx = setupTest();

    const text = ctx.show(
      'grant',
      [],
      [
        buildMockJournalRow({
          ts: '2026-03-03T09:00:00Z',
          op: 'grant',
          id: 'grant',
          by: 'owner',
          text: 'may: Merge it yourself.',
          why: 'covers merges',
          extra: 'where=chat',
        }),
        buildMockJournalRow({ op: 'grant', id: 'grant', by: 'agent', ...stopped }),
      ],
      {
        grant: {
          may: ['Merge it yourself.'],
          not: [],
          never: [],
          scope: null,
          reading: 'covers merges',
          where: 'chat',
          set: '2026-03-03T09:00:00Z',
        },
      },
    );

    expect([
      text.split('\n').at(1),
      text.split('\n').find((line) => line.startsWith('  reading (')),
    ]).toStrictEqual([
      '  words (7d), set on day 2 by owner:',
      '  reading (7d), set on day 2: covers merges',
    ]);
  },
);

test('it prints the none line for show grant when the session holds no grant', () => {
  const ctx = setupTest();

  expect(ctx.show('grant', [], [])).toBe(
    'grant  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"\n',
  );
});

test('it prints the placeholder and no part of a credential in a failing check name', () => {
  const ctx = setupTest();
  const [credential] = buildCredentialSamples();

  const text = ctx.show('pr-api-77', [buildMockItem({ id: 'pr-api-77', check: 'pr:a/b#1' })], [], {
    checkNow: { result: 'OPEN failing', failing: ['lint', credential?.sample ?? ''] },
  });

  expect({
    leaked: text.includes(credential?.tail ?? ''),
    line: text.split('\n').find((row) => row.startsWith('  checked now')),
  }).toStrictEqual({
    leaked: false,
    line: `  checked now: OPEN failing (lint, ${noSecretPlaceholder}) · at write: not checked yet`,
  });
});

test.each([
  { title: 'a NUL', separator: String.fromCodePoint(0) },
  { title: 'a tab', separator: '\t' },
  { title: 'a line feed', separator: '\n' },
  { title: 'a space', separator: ' ' },
])('it prints no part of a credential that $title splits in a failing check name', (row) => {
  const ctx = setupTest();
  const [credential] = buildCredentialSamples();
  const sample = credential?.sample ?? '';
  const split = `${sample.slice(0, 9)}${row.separator}${sample.slice(9)}`;

  const text = ctx.show('pr-api-77', [buildMockItem({ id: 'pr-api-77', check: 'pr:a/b#1' })], [], {
    checkNow: { result: 'OPEN failing', failing: [split] },
  });

  expect({
    leaked: text.includes(sample.slice(9)),
    line: text.split('\n').find((line) => line.startsWith('  checked now')),
  }).toStrictEqual({
    leaked: false,
    line: `  checked now: OPEN failing (${noSecretPlaceholder}) · at write: not checked yet`,
  });
});

test('it prints a failing check name with a line break, a tab and an escape character on one line, with none of them', () => {
  const ctx = setupTest();

  const text = ctx.show('pr-api-77', [buildMockItem({ id: 'pr-api-77', check: 'pr:a/b#1' })], [], {
    checkNow: {
      result: 'OPEN failing',
      failing: [`lint\nsplit\there${String.fromCodePoint(27)}[31m`],
    },
  });

  const row = text.split('\n').find((line) => line.startsWith('  checked now')) ?? '';

  expect({
    row,
    hasControl: /\p{Cc}/u.test(row),
  }).toStrictEqual({
    row: '  checked now: OPEN failing (lint split here [31m) · at write: not checked yet',
    hasControl: false,
  });
});

test('it cuts the line of a failing check name of 300 characters to 100', () => {
  const ctx = setupTest();

  const text = ctx.show('pr-api-77', [buildMockItem({ id: 'pr-api-77', check: 'pr:a/b#1' })], [], {
    checkNow: { result: 'OPEN failing', failing: ['n'.repeat(300)] },
  });

  const row = text.split('\n').find((line) => line.startsWith('  checked now')) ?? '';

  expect([Array.from(row, (character) => character).length, row.endsWith('…')]).toStrictEqual([
    100,
    true,
  ]);
});

test('it prints no names after a result that is not OPEN failing', () => {
  const ctx = setupTest();

  const text = ctx.show('pr-api-77', [buildMockItem({ id: 'pr-api-77', check: 'pr:a/b#1' })], [], {
    checkNow: { result: 'OPEN pending', failing: ['lint'] },
  });

  expect(text).toInclude('  checked now: OPEN pending · at write: not checked yet\n');
});
