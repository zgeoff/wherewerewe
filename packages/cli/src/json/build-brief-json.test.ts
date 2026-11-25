import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
import { buildBriefJSON } from './build-brief-json.ts';

function setupTest() {
  return {
    root: createTempDir('build-brief-json').path,
    buildBriefJSON,
    seed: seedJsonShapesStore,
    run: runJsonCommand,
  };
}

test('it names the session, its day, the host with none for no host, the goal and the figure', () => {
  const ctx = setupTest();

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({}),
    prs: [],
    decideRows: [],
    estimate: 123,
  });

  expect({
    session: brief.session,
    day: brief.day,
    host: brief.host,
    goal: brief.goal,
    estimate: brief.estimate,
    grant: brief.grant,
    focus: brief.focus,
    next: brief.next,
  }).toStrictEqual({
    session: 'tide-alerts',
    day: 9,
    host: 'none',
    goal: 'Ship tide alerts in bosun-api and bosun-app.',
    estimate: 123,
    grant: null,
    focus: null,
    next: null,
  });
});

test('it shows the result this read got as the last result of a checked item', () => {
  const ctx = setupTest();

  const checked = buildMockItem({
    id: 't-a',
    check: 'pr:bosunhq/bosun-api#77',
    last: 'OPEN pending',
  });

  const plain = buildMockItem({ id: 't-b', last: 'stale' });

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({
      items: [checked, plain],
      results: new Map([
        ['t-a', 'MERGED'],
        ['t-b', 'ignored'],
      ]),
    }),
    prs: [],
    decideRows: [],
    estimate: 0,
  });

  expect(
    brief.open.map((shown) => ({
      id: 'id' in shown.row ? shown.row.id : '',
      last: 'last' in shown.row ? shown.row.last : null,
    })),
  ).toIncludeSameMembers([
    { id: 't-a', last: 'MERGED' },
    { id: 't-b', last: 'stale' },
  ]);
});

test('it holds the decide row of each decision in force, whole', () => {
  const ctx = setupTest();

  const row = buildMockJournalRow({
    ts: '2026-03-10T10:00:00Z',
    op: 'decide',
    id: 'd-2',
    text: 'Use UTC',
  });

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({ decisions: [{ id: 'd-2', choice: 'Use UTC' }] }),
    prs: [],
    decideRows: [row],
    estimate: 0,
  });

  expect(brief.decisions).toStrictEqual([row]);
});

test.each([['day 9' as const], ['worst case' as const]])(
  'it prints www --json as its type for the %s store',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);
    const printed = await ctx.run(env, []);

    const result = jsonSchemas.brief.safeParse(printed.value);

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
