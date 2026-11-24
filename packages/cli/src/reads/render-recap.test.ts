import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import type { Grant } from '../types.ts';
import { renderRecap } from './render-recap.ts';
import type { RecapInput } from './render-recap.ts';

function setupTest() {
  const nowMs = Date.parse('2026-03-10T12:00:00Z');

  const defaults: RecapInput = {
    session: buildMockSession({}),
    items: [],
    notes: [],
    rows: [],
    sinceText: '24h',
    sessionID: 'tide-alerts',
    sessionFlag: 'tide-alerts',
    fromMs: nowMs - 86_400_000,
    nowMs,
  };

  const designGrant: Grant = {
    may: [
      'merge the alert PRs once CI is green and every review finding is answered',
      'deploy either app to staging whenever you need to',
      'wipe or reseed the staging alerts table as often as you like',
      'open PRs on tidal-org/tidekit from our fork',
    ],
    not: ['the prod database'],
    never: ['the prod push certificate', 'publishing a tidekit release'],
    scope: 'in bosun-api, bosun-app and tidekit',
    reading:
      'covers merges in both repos on green CI with findings answered, staging deploys, the staging alerts table, opening tidekit PRs; kept back: prod push cert, prod database, tidekit merges and releases',
    where: 'chat',
    set: '2026-03-03T12:00:00Z',
  };

  return {
    nowMs,
    designGrant,
    render: (fields: Partial<RecapInput>) => renderRecap({ ...defaults, ...fields }),
    renderLines: (fields: Partial<RecapInput>) =>
      renderRecap({ ...defaults, ...fields })
        .split('\n')
        .slice(0, -1),
  };
}

test('it renders the recap of the design example line for line', () => {
  const ctx = setupTest();

  const noNoteIDs = [
    'pr-tk-19',
    't-e2e',
    'w-apns',
    'w-tk',
    'ok-prod-index',
    'r-api-tests',
    'r-tk-fork',
    'r-sim-port',
    'p-sim',
    'r-last',
  ];

  const text = ctx.render({
    session: buildMockSession({ grant: ctx.designGrant }),
    items: [
      buildMockItem({ id: 't-flag', claim: 'Turn on the tide_alerts flag in staging config' }),
      buildMockItem({
        id: 'pr-api-77',
        claim: 'Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07',
      }),
      buildMockItem({
        id: 'wt-tz',
        kind: 'where',
        claim: 'bosun-api worktree for the time zone fix, branch tz-fix',
      }),
      ...noNoteIDs.map((id) => buildMockItem({ id })),
    ],
    notes: [
      buildMockNote({
        id: 'wt-tz',
        written: '2026-03-08T12:00:00Z',
        note: 'Remove it with git worktree remove once the tz-fix PR merges; the simulator reads it from the old path until then',
      }),
      buildMockNote({
        id: 'pr-api-77',
        written: '2026-03-10T11:00:00Z',
        note: "The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2 s apart, and give up.",
      }),
      buildMockNote({
        id: 't-flag',
        owed: true,
        written: '2026-03-08T12:00:00Z',
        note: 'Turn the tide_alerts flag back off in staging config before this closes: staging is shared with QA',
      }),
    ],
    rows: [
      ...Array.from({ length: 20 }, () =>
        buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'set', id: 't-a' }),
      ),
      buildMockJournalRow({
        ts: '2026-03-09T13:00:00Z',
        op: 'decide',
        id: 'd-23',
        text: 'Retry a 503 from the tide feed 3 times, 2 s apart',
        why: 'The feed returns 503 for about 4 s at each hourly refresh, then recovers',
      }),
      buildMockJournalRow({
        ts: '2026-03-09T14:00:00Z',
        op: 'ruled-out',
        id: 'd-24',
        text: 'Queue failed alerts for the next tide',
        why: 'a queued alert lands after low water',
      }),
      buildMockJournalRow({
        ts: '2026-03-09T15:00:00Z',
        op: 'done',
        id: 't-fixtures',
        why: 'bosunhq/bosun-api#75 merged as 0c41d2e',
      }),
      buildMockJournalRow({
        ts: '2026-03-09T16:00:00Z',
        op: 'done',
        id: 'w-design',
        why: 'the owner picked the 2-hour lead in chat, day 8',
      }),
      buildMockJournalRow({
        ts: '2026-03-09T17:00:00Z',
        op: 'done',
        id: 'pr-app-61',
        by: 'hook',
        why: 'merged as 51aa0e2, seen by check',
      }),
    ],
  });

  expect(text).toBe(
    [
      'tide-alerts · day 9 · recap since day 8 12:00Z (24h) · 24 writes',
      'GRANT  from the owner in chat, 7d ago · in bosun-api, bosun-app and tidekit',
      '  may    • merge the alert PRs once CI is green and every review finding is answered',
      '         • deploy either app to staging whenever you need to',
      '         • wipe or reseed the staging alerts table as often as you like',
      '         • open PRs on tidal-org/tidekit from our fork',
      '  not    • the prod database',
      '  never  • the prod push certificate  • publishing a tidekit release',
      '  reading: covers merges in both repos on green CI with findings answered, staging deploys, the',
      '    staging alerts table, opening tidekit PRs; kept back: prod push cert, prod database, tidekit',
      '    merges and releases',
      'NOTES (3 of 3 open items with a note) · owed first, then newest',
      '  t-flag      Turn on the tide_alerts flag in staging config',
      '    owed note (2d): Turn the tide_alerts flag back off in staging config before this closes: stagin…',
      '  pr-api-77   Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07',
      "    note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, …",
      '  wt-tz       bosun-api worktree for the time zone fix, branch tz-fix',
      '    note (2d): Remove it with git worktree remove once the tz-fix PR merges; the simulator reads it…',
      '  no note: pr-tk-19, t-e2e, w-apns, w-tk, ok-prod-index, r-api-tests, r-tk-fork, r-sim-port, p-sim,…',
      'DECIDED SINCE day 8 12:00Z (2)',
      '  d-23  Retry a 503 from the tide feed 3 times, 2 s apart · why: The feed returns 503 for about 4 s…',
      '  d-24  ruled out: Queue failed alerts for the next tide · why: a queued alert lands after low water',
      'CLOSED SINCE day 8 12:00Z (3)',
      '  t-fixtures  done · bosunhq/bosun-api#75 merged as 0c41d2e',
      '  w-design    done · the owner picked the 2-hour lead in chat, day 8',
      '  pr-app-61   done · merged as 51aa0e2, seen by check',
      'Whole text: www --session tide-alerts show <id>',
      'Correct: www --session tide-alerts say "<text>" [--on <id>]',
      '',
    ].join('\n'),
  );
});

test('it lists owed notes first, then the rest newest first, ties in notes.tsv order', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    items: ['t-a', 't-b', 't-c', 't-d'].map((id) => buildMockItem({ id, claim: `claim ${id}` })),
    notes: [
      buildMockNote({ id: 't-a', written: '2026-03-10T10:00:00Z', note: 'a' }),
      buildMockNote({ id: 't-d', written: '2026-03-10T11:00:00Z', note: 'd' }),
      buildMockNote({ id: 't-c', owed: true, written: '2026-03-09T11:00:00Z', note: 'c' }),
      buildMockNote({ id: 't-b', written: '2026-03-10T11:00:00Z', note: 'b' }),
    ],
  });

  expect(lines.slice(2, 11)).toStrictEqual([
    'NOTES (4 of 4 open items with a note) · owed first, then newest',
    '  t-c         claim t-c',
    '    owed note (25h): c',
    '  t-d         claim t-d',
    '    note (1h): d',
    '  t-b         claim t-b',
    '    note (1h): b',
    '  t-a         claim t-a',
    '    note (2h): a',
  ]);
});

test('it prints 6 notes and an overflow line that names the rest, when 7 items have a note', () => {
  const ctx = setupTest();
  const ids = buildMockIDs('item', 7);

  const lines = ctx.renderLines({
    items: ids.map((id) => buildMockItem({ id })),
    notes: ids.map((id, index) =>
      buildMockNote({ id, written: `2026-03-10T11:0${String(index)}:00Z` }),
    ),
  });

  expect(lines.filter((line) => /^NOTES|^ {2}and /u.test(line))).toStrictEqual([
    'NOTES (6 of 7 open items with a note) · owed first, then newest',
    '  and 1 more with a note: www --session tide-alerts log --op note',
  ]);
});

test('it prints an approval with its quote in double quotes', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    items: [buildMockItem({ id: 'ok-wipe', kind: 'ok', claim: 'wipe the staging table once' })],
    notes: [buildMockNote({ id: 'ok-wipe', note: 'Spent on day 9.' })],
  });

  expect(lines.slice(2, 5)).toStrictEqual([
    'NOTES (1 of 1 open items with a note) · owed first, then newest',
    '  ok-wipe     "wipe the staging table once"',
    '    note (1h): Spent on day 9.',
  ]);
});

test('it names the open items with no note in items.tsv order', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    items: ['t-z', 't-a', 't-m'].map((id) => buildMockItem({ id })),
    notes: [buildMockNote({ id: 't-a' })],
  });

  expect(lines.slice(2, 6)).toStrictEqual([
    'NOTES (1 of 1 open items with a note) · owed first, then newest',
    '  t-a         Write the parser',
    '    note (1h): The simulator is shared on Fridays',
    '  no note: t-z, t-m',
  ]);
});

test('it leaves NOTES out when no item is open', () => {
  const ctx = setupTest();
  const lines = ctx.renderLines({ items: [], notes: [] });

  expect(lines).toStrictEqual([
    'tide-alerts · day 9 · recap since day 8 12:00Z (24h) · 0 writes',
    'GRANT  none. Run: www --session tide-alerts show grant',
    'Whole text: www --session tide-alerts show <id>',
    'Correct: www --session tide-alerts say "<text>" [--on <id>]',
  ]);
});

test('it prints 0 of 0 and the no note line when open items have no note', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    items: [buildMockItem({ id: 't-a' }), buildMockItem({ id: 't-b' })],
  });

  expect(lines.slice(2, 4)).toStrictEqual([
    'NOTES (0 of 0 open items with a note) · owed first, then newest',
    '  no note: t-a, t-b',
  ]);
});

test('it prints the 5 oldest decisions and an overflow line that names the rest', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    sinceText: '3d',
    fromMs: ctx.nowMs - 3 * 86_400_000,
    rows: [6, 2, 4, 1, 5, 3].map((number) =>
      buildMockJournalRow({
        ts: `2026-03-10T0${String(number)}:00:00Z`,
        op: 'decide',
        id: `d-${String(number)}`,
        text: `choice ${String(number)}`,
        why: `reason ${String(number)}`,
      }),
    ),
  });

  expect(lines.slice(2, 9)).toStrictEqual([
    'DECIDED SINCE day 6 12:00Z (6)',
    '  d-1  choice 1 · why: reason 1',
    '  d-2  choice 2 · why: reason 2',
    '  d-3  choice 3 · why: reason 3',
    '  d-4  choice 4 · why: reason 4',
    '  d-5  choice 5 · why: reason 5',
    '  and 1 more: www --session tide-alerts log --op decide,ruled-out --since 3d',
  ]);
});

test('it prints a ruled-out row with its label, and a missing choice or reason as a dash', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    rows: [
      buildMockJournalRow({
        ts: '2026-03-10T01:00:00Z',
        op: 'ruled-out',
        id: 'd-7',
        text: 'poll every second',
        why: 'it hits the rate limit',
      }),
      buildMockJournalRow({ ts: '2026-03-10T02:00:00Z', op: 'decide', id: 'd-8' }),
    ],
  });

  expect(lines.slice(2, 5)).toStrictEqual([
    'DECIDED SINCE day 8 12:00Z (2)',
    '  d-7  ruled out: poll every second · why: it hits the rate limit',
    '  d-8  - · why: -',
  ]);
});

test('it prints each close with its word and its evidence, reason or use, and an overflow line', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    rows: [
      ['done', 't-a', 'merged as 0c41d2e'],
      ['drop', 't-b', 'the owner changed the plan'],
      ['use', 'ok-wipe', 'wiped the staging table'],
      ['done', 't-c', 'c'],
      ['done', 't-d', 'd'],
      ['done', 't-e', 'e'],
    ].map(([op, id, why], index) =>
      buildMockJournalRow({
        ts: `2026-03-10T0${String(index + 1)}:00:00Z`,
        op: op ?? '',
        id: id ?? '',
        why: why ?? null,
      }),
    ),
  });

  expect(lines.slice(2, 9)).toStrictEqual([
    'CLOSED SINCE day 8 12:00Z (6)',
    '  t-a         done · merged as 0c41d2e',
    '  t-b         dropped · the owner changed the plan',
    '  ok-wipe     used · wiped the staging table',
    '  t-c         done · c',
    '  t-d         done · d',
    '  and 1 more: www --session tide-alerts log --op done,drop,use --since 24h',
  ]);
});

test('it cuts a line of 201 characters to 99 and an ellipsis', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    items: [buildMockItem({ id: 't-a', claim: 'c'.repeat(201) })],
    notes: [buildMockNote({ id: 't-a' })],
  });

  expect(lines[3]).toBe(`  t-a         ${'c'.repeat(85)}…`);
});

test('it never cuts an overflow line or a footer line', () => {
  const ctx = setupTest();
  const sinceText = 'day-99999999999999999999';
  const name = 'n'.repeat(24);

  const lines = ctx.renderLines({
    session: buildMockSession({ name }),
    sessionID: name,
    sessionFlag: name,
    sinceText,
    rows: Array.from({ length: 6 }, (_unused, index) =>
      buildMockJournalRow({
        ts: `2026-03-10T0${String(index)}:00:00Z`,
        op: 'decide',
        id: `d-${String(index)}`,
      }),
    ),
  });

  expect(lines.slice(-3)).toStrictEqual([
    `  and 1 more: www --session ${name} log --op decide,ruled-out --since ${sinceText}`,
    `Whole text: www --session ${name} show <id>`,
    `Correct: www --session ${name} say "<text>" [--on <id>]`,
  ]);
});

test('it prints no GRANT block but one line when the session has no grant', () => {
  const ctx = setupTest();
  const lines = ctx.renderLines({ session: buildMockSession({ grant: null }) });

  expect(lines[1]).toBe('GRANT  none. Run: www --session tide-alerts show grant');
});

test('it says the journal is unreadable and leaves out both SINCE sections when rows is null', () => {
  const ctx = setupTest();
  const lines = ctx.renderLines({ rows: null });

  expect(lines).toStrictEqual([
    'tide-alerts · day 9 · recap since day 8 12:00Z (24h) · journal unreadable',
    'GRANT  none. Run: www --session tide-alerts show grant',
    'Whole text: www --session tide-alerts show <id>',
    'Correct: www --session tide-alerts say "<text>" [--on <id>]',
  ]);
});

test('it counts only the agent and owner rows as writes', () => {
  const ctx = setupTest();
  const row = { ts: '2026-03-10T01:00:00Z', op: 'set', id: 't-a' };

  const lines = ctx.renderLines({
    rows: [
      buildMockJournalRow({ ...row, by: 'agent' }),
      buildMockJournalRow({ ...row, by: 'owner' }),
      buildMockJournalRow({ ...row, by: 'hook' }),
      buildMockJournalRow({ ...row, by: 'import' }),
    ],
  });

  expect(lines[0]).toBe('tide-alerts · day 9 · recap since day 8 12:00Z (24h) · 2 writes');
});

test('it prints day 1 and the time of the start when the window opens at the start', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    sinceText: '30d',
    fromMs: Date.parse('2026-03-02T08:04:11Z'),
    rows: [buildMockJournalRow({ ts: '2026-03-02T09:00:00Z', op: 'done', id: 't-a', why: 'e' })],
  });

  expect([lines[0], lines[2]]).toStrictEqual([
    'tide-alerts · day 9 · recap since day 1 08:04Z (30d) · 1 writes',
    'CLOSED SINCE day 1 08:04Z (1)',
  ]);
});

test('it prints the footer without --session when the recap ran in a bound session', () => {
  const ctx = setupTest();
  const lines = ctx.renderLines({ sessionFlag: null });

  expect(lines.slice(-2)).toStrictEqual([
    'Whole text: www show <id>',
    'Correct: www say "<text>" [--on <id>]',
  ]);
});

test('it prints a credential that crosses column 100 as the placeholder, with no part of it left', () => {
  const ctx = setupTest();
  const credential = ['xoxb', '-', '12345'].join('');

  const lines = ctx.renderLines({
    items: [buildMockItem({ id: 't-a', claim: `${'c'.repeat(80)} ${credential} tail` })],
    notes: [buildMockNote({ id: 't-a', note: 'plain' })],
    rows: [
      buildMockJournalRow({
        ts: '2026-03-10T11:00:00Z',
        op: 'decide',
        id: 'd-1',
        text: `${'c'.repeat(80)} ${credential} tail`,
        why: 'plain',
      }),
    ],
  });

  const printed = lines.filter((line) => line.includes('c'.repeat(80)));

  expect({
    printed,
    leaked: lines.filter((line) => /xox|12345/u.test(line)),
    widths: printed.map((line) => line.split(/(?:)/u).length),
  }).toStrictEqual({
    printed: [`  t-a         ${'c'.repeat(80)} <whe…`, `  d-1  ${'c'.repeat(80)} <where the …`],
    leaked: [],
    widths: [100, 100],
  });
});

test('it keeps a line at 100 characters when the cut leaves the bare name of a credential pattern at its end', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    rows: [
      buildMockJournalRow({
        ts: '2026-03-10T11:00:00Z',
        op: 'decide',
        id: 'd-1',
        text: `${'c'.repeat(86)} xoxb- tail`,
        why: 'plain',
      }),
    ],
  });

  expect(lines[3]).toBe(`  d-1  ${'c'.repeat(86)} <wher…`);
});

test('it prints the folder name of the session in each command, never the name the file holds', () => {
  const ctx = setupTest();

  const lines = ctx.renderLines({
    session: buildMockSession({ name: 'other; rm -rf x' }),
    sessionID: 'tide-alerts',
    sessionFlag: null,
    items: [
      buildMockItem({ id: 't-a', claim: 'one' }),
      ...buildMockIDs('item', 7).map((id) => buildMockItem({ id, claim: 'two' })),
    ],
    notes: buildMockIDs('item', 7).map((id) => buildMockNote({ id })),
  });

  expect(lines.filter((line) => line.includes('www --session'))).toStrictEqual([
    'GRANT  none. Run: www --session tide-alerts show grant',
    '  and 1 more with a note: www --session tide-alerts log --op note',
  ]);
});

test('it renders the worst case in 55 lines, each at most 100 characters, and at most 5,555 characters', () => {
  const ctx = setupTest();
  const name = 'n'.repeat(24);
  const worstNowMs = Date.parse('2026-03-10T12:00:00Z');

  const started = new Date(worstNowMs - 998 * 86_400_000).toISOString().replace('.000', '');

  const dayStartMs = Date.parse(`${new Date(worstNowMs).toISOString().slice(0, 10)}T00:00:00Z`);
  const tasks = buildMockIDs('task', 6);
  const waits = buildMockIDs('wait', 4);
  const approvals = buildMockIDs('appr', 1);
  const rules = buildMockIDs('rule', 5);
  const whereIDs = buildMockIDs('here', 4);

  const items = [
    ...tasks.map((id) => buildMockItem({ id, claim: 'c'.repeat(120) })),
    ...waits.map((id) => buildMockItem({ id, kind: 'wait', claim: 'c'.repeat(120) })),
    ...approvals.map((id) => buildMockItem({ id, kind: 'ok', claim: 'q'.repeat(120) })),
    ...rules.map((id) => buildMockItem({ id, kind: 'rule', claim: 'c'.repeat(120) })),
    ...whereIDs.map((id) => buildMockItem({ id, kind: 'where', claim: 'c'.repeat(120) })),
  ];

  const text = ctx.render({
    session: buildMockSession({
      name,
      started,
      grant: {
        may: Array.from({ length: 7 }, () => 'm'.repeat(90)),
        not: Array.from({ length: 5 }, () => 'x'.repeat(6)),
        never: [],
        scope: 's'.repeat(40),
        reading: buildSpacedText(200),
        where: 'w'.repeat(16),
        set: '2026-03-03T09:00:00Z',
      },
    }),
    sessionID: name,
    sessionFlag: name,
    sinceText: 'day-999',
    fromMs: dayStartMs,
    items,
    notes: items.slice(0, 19).map((item) =>
      buildMockNote({
        id: item.id,
        owed: true,
        note: [...Array.from({ length: 4 }, () => 'n'.repeat(81)), 'n'.repeat(72)].join(' '),
      }),
    ),
    rows: [
      ...Array.from({ length: 9 }, (_unused, index) =>
        buildMockJournalRow({
          ts: `2026-03-10T0${String(index)}:00:00Z`,
          op: 'decide',
          id: `d-${String(index + 1)}`,
          text: 'c'.repeat(200),
          why: 'r'.repeat(200),
        }),
      ),
      ...Array.from({ length: 9 }, (_unused, index) =>
        buildMockJournalRow({
          ts: `2026-03-10T0${String(index)}:30:00Z`,
          op: 'done',
          id: buildMockIDs('done', 9)[index] ?? '',
          why: 'e'.repeat(200),
        }),
      ),
      ...Array.from({ length: 1000 }, () =>
        buildMockJournalRow({ ts: '2026-03-10T05:00:00Z', op: 'set', id: 't-a' }),
      ),
    ],
  });

  const lines = text.split('\n').slice(0, -1);

  expect({
    header: lines[0],
    lines: lines.length,
    widest: Math.max(...lines.map((line) => line.split(/(?:)/u).length)),
    isWithinLimit: text.split(/(?:)/u).length <= 5555,
  }).toStrictEqual({
    header: `${name} · day 999 · recap since day 999 00:00Z (day-999) · 1018 writes`,
    lines: 55,
    widest: 100,
    isWithinLimit: true,
  });
});
