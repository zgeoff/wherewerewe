import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockGrant } from '../test-utils/build-mock-grant.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { buildShowJSON } from './build-show-json.ts';

function setupTest() {
  return {
    root: createTempDir('build-show-json').path,
    buildShowJSON,
    seed: seedJsonShapesStore,
    run: runJsonCommand,
  };
}

test('it holds every open task in the order the text form lists them, with no journal', () => {
  const ctx = setupTest();
  const older = buildMockItem({ id: 't-old', written: '2026-03-08T10:00:00Z' });
  const newer = buildMockItem({ id: 't-new', written: '2026-03-10T10:00:00Z' });

  const decision = buildMockJournalRow({
    ts: '2026-03-10T09:00:00Z',
    op: 'decide',
    id: 'd-1',
    extra: 'on=t-new',
  });

  const shown = ctx.buildShowJSON({
    id: null,
    store: buildMockStore({ items: [older, newer], notes: [buildMockNote({ id: 't-old' })] }),
    rows: [decision],
    checkNows: [],
  });

  expect(
    shown.subjects.map((subject) => ({
      kind: subject.kind,
      row: subject.row,
      journal: subject.journal,
      decisions: 'decisions' in subject ? subject.decisions : null,
    })),
  ).toStrictEqual([
    { kind: 'task', row: newer, journal: null, decisions: ['d-1'] },
    { kind: 'task', row: older, journal: null, decisions: [] },
  ]);
});

test('it holds an open item with its note, its check now, the failing checks and its journal rows', () => {
  const ctx = setupTest();
  const item = buildMockItem({ id: 'pr-api-77', check: 'pr:bosunhq/bosun-api#77' });
  const note = buildMockNote({ id: 'pr-api-77' });
  const row = buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'task', id: 'pr-api-77' });

  const shown = ctx.buildShowJSON({
    id: 'pr-api-77',
    store: buildMockStore({ items: [item], notes: [note] }),
    rows: [row],
    checkNows: [{ result: 'OPEN failing', failing: ['lint', ' e2e '] }],
  });

  expect(shown.subjects).toStrictEqual([
    {
      kind: 'task',
      row: item,
      note,
      checkedNow: 'OPEN failing',
      failingChecks: ['lint', 'e2e'],
      decisions: [],
      journal: [row],
    },
  ]);
});

test.each([
  { title: 'a lesson', id: 'l-seed', kind: 'lesson' },
  { title: 'a promise', id: 'due-cost', kind: 'promise' },
  { title: "the owner's words", id: 'w-small', kind: 'words' },
])('it holds $title with no note and no check', (row) => {
  const ctx = setupTest();

  const shown = ctx.buildShowJSON({
    id: row.id,
    store: buildMockStore({
      lessons: [
        {
          id: 'l-seed',
          text: 'Pin the clock',
          why: 'A stale row',
          written: '2026-03-10T09:00:00Z',
          by: 'agent',
        },
      ],
      promises: [
        {
          id: 'due-cost',
          what: 'The cost table',
          to: 'owner',
          byWhen: 'Friday',
          written: '2026-03-10T09:00:00Z',
          by: 'agent',
        },
      ],
      words: [
        {
          id: 'w-small',
          words: 'Keep PRs small',
          where: 'chat',
          written: '2026-03-10T09:00:00Z',
          by: 'owner',
        },
      ],
    }),
    rows: [],
    checkNows: [],
  });

  expect(
    shown.subjects.map((subject) => [subject.kind, 'note' in subject ? subject.note : 'none']),
  ).toStrictEqual([[row.kind, null]]);
});

test('it holds a grant as its options, with null for no grant, and every grant journal row', () => {
  const ctx = setupTest();
  const grant = buildMockGrant({ may: ['merge on green CI'], never: ['publish a release'] });
  const row = buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'grant', id: 'grant' });

  const given = ctx.buildShowJSON({
    id: 'grant',
    store: buildMockStore({ session: buildMockSession({ grant }) }),
    rows: [row],
    checkNows: [],
  });

  const none = ctx.buildShowJSON({
    id: 'grant',
    store: buildMockStore({}),
    rows: [],
    checkNows: [],
  });

  expect([given.subjects, none.subjects]).toStrictEqual([
    [
      {
        kind: 'grant',
        row: {
          may: ['merge on green CI'],
          never: ['publish a release'],
          where: 'chat',
          reading: 'covers it',
        },
        journal: [row],
      },
    ],
    [{ kind: 'grant', row: null, journal: [] }],
  ]);
});

test('it holds only the grant rows as the journal of the grant, in a session named grant', () => {
  const ctx = setupTest();
  const init = buildMockJournalRow({ ts: '2026-03-10T08:00:00Z', op: 'goal', id: 'grant' });
  const row = buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'grant', id: 'grant' });

  const shown = ctx.buildShowJSON({
    id: 'grant',
    store: buildMockStore({}),
    rows: [init, row],
    checkNows: [],
  });

  expect(shown.subjects).toStrictEqual([{ kind: 'grant', row: null, journal: [row] }]);
});

test('it names a ruled-out row among the decisions of a task in the list of every open task', () => {
  const ctx = setupTest();

  const ruledOut = buildMockJournalRow({
    ts: '2026-03-10T09:00:00Z',
    op: 'ruled-out',
    id: 'd-1',
    extra: 'on=t-a',
  });

  const shown = ctx.buildShowJSON({
    id: null,
    store: buildMockStore({ items: [buildMockItem({ id: 't-a' })] }),
    rows: [ruledOut],
    checkNows: [],
  });

  expect(
    shown.subjects.map((subject) => ('decisions' in subject ? subject.decisions : null)),
  ).toStrictEqual([['d-1']]);
});

test.each([{ argv: ['show'] }, { argv: ['show', 't-a'] }])(
  'it names a ruled-out row among the decisions of a task for www $argv --json',
  async (row) => {
    const ctx = setupTest();
    const stateRoot = join(ctx.root, 'wherewerewe');

    const folder = await seedSessionStore(stateRoot, 'tide-alerts');

    await seedItem(folder, { id: 't-a' });

    await seedJournalRow(folder, {
      ts: '2026-03-10T09:00:00Z',
      op: 'ruled-out',
      id: 'd-1',
      extra: 'on=t-a',
    });

    const printed = await ctx.run(
      {
        HOME: ctx.root,
        XDG_STATE_HOME: ctx.root,
        CLAUDE_CODE_SESSION_ID: '',
        WHEREWEREWE_SESSION: 'tide-alerts',
      },
      row.argv,
    );

    expect(
      jsonSchemas.show
        .parse(printed.value)
        .subjects.map((subject) => ('decisions' in subject ? subject.decisions : null)),
    ).toStrictEqual([['d-1']]);
  },
);

test('it holds a decision with its journal rows', () => {
  const ctx = setupTest();

  const row = buildMockJournalRow({
    ts: '2026-03-10T09:00:00Z',
    op: 'decide',
    id: 'd-4',
    text: 'Use UTC',
  });

  const shown = ctx.buildShowJSON({
    id: 'd-4',
    store: buildMockStore({}),
    rows: [row],
    checkNows: [],
  });

  expect(shown.subjects).toStrictEqual([{ kind: 'decision', row, journal: [row] }]);
});

test.each([
  {
    title: 'a closed item',
    rows: [buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'done', id: 't-a' })],
  },
  {
    title: 'an id with journal rows only',
    rows: [buildMockJournalRow({ ts: '2026-03-10T09:00:00Z', op: 'goal', id: 't-a' })],
  },
  { title: 'an id with no row', rows: [] },
])('it holds no subject for $title', (row) => {
  const ctx = setupTest();

  const shown = ctx.buildShowJSON({
    id: 't-a',
    store: buildMockStore({}),
    rows: row.rows,
    checkNows: [],
  });

  expect(shown.subjects).toStrictEqual([]);
});

test.each([['day 9' as const], ['worst case' as const]])(
  'it prints www show --json as its type for the %s store',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);
    const printed = await ctx.run(env, ['show']);

    const result = jsonSchemas.show.safeParse(printed.value);

    expect({
      exitCode: printed.exitCode,
      lines: printed.lines,
      issues: result.error?.issues,
    }).toStrictEqual({
      exitCode: 0,
      lines: 1,
      issues: undefined,
    });
  },
);

test.each([
  { store: 'day 9' as const, id: 't-flag', kinds: ['task'] },
  { store: 'day 9' as const, id: 'w-apns', kinds: ['wait'] },
  { store: 'day 9' as const, id: 'ok-prod-index', kinds: ['ok'] },
  { store: 'day 9' as const, id: 'r-sim-port', kinds: ['rule'] },
  { store: 'day 9' as const, id: 'wt-tz', kinds: ['where'] },
  { store: 'day 9' as const, id: 'l-seed', kinds: ['lesson'] },
  { store: 'day 9' as const, id: 'due-cost', kinds: ['promise'] },
  { store: 'day 9' as const, id: 'w-small-prs', kinds: ['words'] },
  { store: 'day 9' as const, id: 'grant', kinds: ['grant'] },
  { store: 'day 9' as const, id: 'd-23', kinds: ['decision'] },
  { store: 'day 9' as const, id: 's-staging', kinds: ['where'] },
  { store: 'day 9' as const, id: 'no-such-id', kinds: [] },
  { store: 'worst case' as const, id: buildMockIDs('task', 30)[0] ?? '', kinds: ['task'] },
  { store: 'worst case' as const, id: buildMockIDs('wait', 1)[0] ?? '', kinds: ['wait'] },
  { store: 'worst case' as const, id: 'appr01', kinds: ['ok'] },
  { store: 'worst case' as const, id: buildMockIDs('rule', 1)[0] ?? '', kinds: ['rule'] },
  { store: 'worst case' as const, id: buildMockIDs('here', 1)[0] ?? '', kinds: ['where'] },
  { store: 'worst case' as const, id: buildMockIDs('less', 1)[0] ?? '', kinds: ['lesson'] },
  { store: 'worst case' as const, id: buildMockIDs('prom', 1)[0] ?? '', kinds: ['promise'] },
  { store: 'worst case' as const, id: buildMockIDs('word', 1)[0] ?? '', kinds: ['words'] },
  { store: 'worst case' as const, id: 'grant', kinds: ['grant'] },
  { store: 'worst case' as const, id: 'd-1', kinds: ['decision'] },
  { store: 'worst case' as const, id: 'no-such-id', kinds: [] },
])('it prints www show $id --json as its type for the $store store', async (row) => {
  const ctx = setupTest();

  const env = await ctx.seed(ctx.root, row.store);
  const printed = await ctx.run(env, ['show', row.id]);

  const result = jsonSchemas.show.safeParse(printed.value);

  expect({
    exitCode: printed.exitCode,
    lines: printed.lines,
    issues: result.error?.issues,
    kinds: result.data?.subjects.map((subject) => subject.kind),
  }).toStrictEqual({
    exitCode: 0,
    lines: 1,
    issues: undefined,
    kinds: [...row.kinds],
  });
});
