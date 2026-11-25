import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockGrant } from '../test-utils/build-mock-grant.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
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
    decisionRows: [],
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

test('it holds the pin as a string, and as null with none', () => {
  const ctx = setupTest();

  const build = (pin: string | null) =>
    ctx.buildBriefJSON({
      brief: buildMockBriefInput({ pin }),
      prs: [],
      decisionRows: [],
      estimate: 0,
    }).pin;

  expect([build('Small and plain.'), build(null)]).toStrictEqual(['Small and plain.', null]);
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
    decisionRows: [],
    estimate: 0,
  });

  expect(brief.open).toIncludeSameMembers([
    { kind: 'task', row: { ...checked, last: 'MERGED' }, note: null },
    { kind: 'task', row: plain, note: null },
  ]);
});

test.each([
  { title: 'the next step', nowHidden: null, next: 'run the tests' },
  {
    title: 'null when the next step hides as changed',
    nowHidden: { kind: 'changed' as const },
    next: null,
  },
  {
    title: 'null when the next step hides as a reading',
    nowHidden: { kind: 'reads' as const, result: 'MERGED' },
    next: null,
  },
])('it holds $title in next and the item in focus in focus', (row) => {
  const ctx = setupTest();

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({
      items: [buildMockItem({ id: 't-a' })],
      session: buildMockSession({ now: 't-a', nowNext: 'run the tests' }),
      nowHidden: row.nowHidden,
    }),
    prs: [],
    decisionRows: [],
    estimate: 0,
  });

  expect({ focus: brief.focus, next: brief.next }).toStrictEqual({ focus: 't-a', next: row.next });
});

test('it holds each changed item with its result at write and its result now', () => {
  const ctx = setupTest();
  const item = buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'alive' });

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({ items: [item], changed: [{ item, result: 'gone' }] }),
    prs: [],
    decisionRows: [],
    estimate: 0,
  });

  expect(brief.changed).toStrictEqual([{ id: 't-a', was: 'alive', now: 'gone' }]);
});

test('it holds the open items whole, in the order their sections print, tasks first', () => {
  const ctx = setupTest();
  const where = buildMockItem({ id: 'wh-a', kind: 'where' });
  const rule = buildMockItem({ id: 'r-a', kind: 'rule' });
  const approval = buildMockItem({ id: 'ok-a', kind: 'ok' });
  const wait = buildMockItem({ id: 'w-a', kind: 'wait' });
  const task = buildMockItem({ id: 't-a', kind: 'task' });
  const note = buildMockNote({ id: 'w-a' });

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({ items: [where, rule, approval, wait, task], notes: [note] }),
    prs: [],
    decisionRows: [],
    estimate: 0,
  });

  expect(brief.open).toStrictEqual([
    { kind: 'task', row: task, note: null },
    { kind: 'wait', row: wait, note },
    { kind: 'ok', row: approval, note: null },
    { kind: 'rule', row: rule, note: null },
    { kind: 'where', row: where, note: null },
  ]);
});

test.each([
  { title: 'no grant', grant: null, expected: null },
  {
    title: 'a grant with no scope, which holds no scope key',
    grant: buildMockGrant({ may: ['merge it'], scope: null }),
    expected: { may: ['merge it'], where: 'chat', reading: 'covers it' },
  },
  {
    title: 'a grant with a scope, in the key order of the type',
    grant: buildMockGrant({ may: ['merge it'], scope: 'in the app' }),
    expected: { may: ['merge it'], scope: 'in the app', where: 'chat', reading: 'covers it' },
  },
])('it holds $title as the grant', (row) => {
  const ctx = setupTest();

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({ session: buildMockSession({ grant: row.grant }) }),
    prs: [],
    decisionRows: [],
    estimate: 0,
  });

  expect(JSON.stringify(brief.grant)).toBe(JSON.stringify(row.expected));
});

test('it holds the decide row of each decision in force, whole, two rows of one id included', () => {
  const ctx = setupTest();

  const first = buildMockJournalRow({
    ts: '2026-03-09T10:00:00Z',
    op: 'decide',
    id: 'd-1',
    text: 'First',
  });

  const second = buildMockJournalRow({
    ts: '2026-03-10T10:00:00Z',
    op: 'decide',
    id: 'd-1',
    text: 'Second',
  });

  const ruledOut = buildMockJournalRow({ ts: '2026-03-10T11:00:00Z', op: 'ruled-out', id: 'd-2' });

  const brief = ctx.buildBriefJSON({
    brief: buildMockBriefInput({}),
    prs: [],
    decisionRows: [first, second, ruledOut],
    estimate: 0,
  });

  expect(brief.decisions).toStrictEqual([second, first]);
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
