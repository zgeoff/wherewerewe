import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockGrant } from '../test-utils/build-mock-grant.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
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
  { id: 't-flag' },
  { id: 'w-apns' },
  { id: 'ok-prod-index' },
  { id: 'r-sim-port' },
  { id: 'wt-tz' },
  { id: 'l-seed' },
  { id: 'due-cost' },
  { id: 'w-small-prs' },
  { id: 'grant' },
  { id: 'd-23' },
  { id: 's-staging' },
  { id: 'no-such-id' },
])('it prints www show $id --json as its type for the day 9 store', async (row) => {
  const ctx = setupTest();

  const env = await ctx.seed(ctx.root, 'day 9');
  const printed = await ctx.run(env, ['show', row.id]);

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
});
