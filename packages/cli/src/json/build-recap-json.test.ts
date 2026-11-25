import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockGrant } from '../test-utils/build-mock-grant.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
import { buildRecapJSON } from './build-recap-json.ts';

function setupTest() {
  return {
    root: createTempDir('build-recap-json').path,
    buildRecapJSON,
    seed: seedJsonShapesStore,
    run: runJsonCommand,
    base: {
      items: [],
      notes: [],
      promises: [],
      fromMs: Date.parse('2026-03-09T11:43:00Z'),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
    },
  };
}

test('it holds null for the writes and both lists when the journal cannot be read', () => {
  const ctx = setupTest();
  const recap = ctx.buildRecapJSON({ ...ctx.base, session: buildMockSession({}), rows: null });

  expect({
    writes: recap.writes,
    decidedSince: recap.decidedSince,
    closedSince: recap.closedSince,
  }).toStrictEqual({ writes: null, decidedSince: null, closedSince: null });
});

test.each([
  { fromAt: '2026-03-09T11:43:00.000Z', since: '2026-03-09T11:43:00Z' },
  { fromAt: '2026-03-09T11:43:00.001Z', since: '2026-03-09T11:43:01Z' },
  { fromAt: '2026-03-09T11:43:00.500Z', since: '2026-03-09T11:43:01Z' },
])('it reports the cutoff $fromAt as $since, the first second that keeps the same rows', (row) => {
  const ctx = setupTest();

  const recap = ctx.buildRecapJSON({
    ...ctx.base,
    session: buildMockSession({}),
    rows: [],
    fromMs: Date.parse(row.fromAt),
  });

  expect(recap.since).toBe(row.since);
});

test('it counts the writes of an agent and the owner and holds the decisions and closes whole', () => {
  const ctx = setupTest();

  const decide = buildMockJournalRow({
    ts: '2026-03-10T09:00:00Z',
    op: 'decide',
    id: 'd-1',
    text: 'Use UTC',
  });

  const done = buildMockJournalRow({
    ts: '2026-03-10T10:00:00Z',
    op: 'done',
    id: 't-a',
    text: 'x',
  });

  const changed = buildMockJournalRow({
    ts: '2026-03-10T10:30:00Z',
    op: 'changed',
    id: 't-a',
    by: 'hook',
  });

  const recap = ctx.buildRecapJSON({
    ...ctx.base,
    session: buildMockSession({
      grant: buildMockGrant({ may: ['merge on green CI'], scope: 'in the app' }),
    }),
    rows: [done, changed, decide],
  });

  expect({
    since: recap.since,
    writes: recap.writes,
    grant: recap.grant,
    decidedSince: recap.decidedSince,
    closedSince: recap.closedSince,
  }).toStrictEqual({
    since: '2026-03-09T11:43:00Z',
    writes: 2,
    grant: { may: ['merge on green CI'], scope: 'in the app', where: 'chat', reading: 'covers it' },
    decidedSince: [decide],
    closedSince: [done],
  });
});

test('it lists the notes owed first, then newest, and the open items with no note', () => {
  const ctx = setupTest();
  const noted = buildMockItem({ id: 't-a' });
  const owed = buildMockItem({ id: 't-b' });
  const plain = buildMockItem({ id: 't-c' });

  const recap = ctx.buildRecapJSON({
    ...ctx.base,
    session: buildMockSession({}),
    items: [noted, owed, plain],
    notes: [
      buildMockNote({ id: 't-a', written: '2026-03-10T10:00:00Z' }),
      buildMockNote({ id: 't-b', owed: true, written: '2026-03-09T10:00:00Z' }),
    ],
    rows: [],
  });

  expect({
    notes: recap.notes.map((entry) => entry.note.id),
    otherOpen: recap.otherOpen,
  }).toStrictEqual({
    notes: ['t-b', 't-a'],
    otherOpen: ['t-c'],
  });
});

test.each([['day 9' as const], ['worst case' as const]])(
  'it prints www recap --json as its type for the %s store',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);
    const printed = await ctx.run(env, ['recap']);

    const result = jsonSchemas.recap.safeParse(printed.value);

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
