import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import type { ListKind } from '../rules/list-kinds.ts';
import { listKinds } from '../rules/list-kinds.ts';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { readDesignBlock } from '../test-utils/read-design-block.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
import { buildListJSON } from './build-list-json.ts';
import { jsonVersion } from './json-version.ts';
import type { ListJson } from './types.ts';

function setupTest() {
  return {
    root: createTempDir('build-list-json').path,
    buildListJSON,
    seed: seedJsonShapesStore,
    run: runJsonCommand,
  };
}

test('it lists the open approvals, waits, rules and where rows, each of its own kind', () => {
  const ctx = setupTest();
  const wait = buildMockItem({ id: 'w-a', kind: 'wait' });
  const rule = buildMockItem({ id: 'r-a', kind: 'rule' });
  const task = buildMockItem({ id: 't-a' });
  const brief = buildMockBriefInput({ items: [wait, rule, task] });
  const waits = ctx.buildListJSON('waits', { brief, prs: [], decisionRows: [] });
  const rules = ctx.buildListJSON('rules', { brief, prs: [], decisionRows: [] });

  expect([waits, rules]).toStrictEqual([
    { ...jsonVersion, kind: 'waits', rows: [{ kind: 'wait', row: wait, note: null }] },
    { ...jsonVersion, kind: 'rules', rows: [{ kind: 'rule', row: rule, note: null }] },
  ]);
});

test.each(listKinds)('it lists each row of %s whole, as its type holds it', (kind) => {
  const ctx = setupTest();
  const note = buildMockNote({ id: 't-a', owed: true });
  const task = buildMockItem({ id: 't-a', check: 'pr:bosunhq/bosun-api#7', last: 'OPEN passing' });
  const wait = buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'wren' } });

  const approval = buildMockItem({
    id: 'ok-a',
    kind: 'ok',
    extra: { who: 'jo', where: 'slack', scope: 'in the app' },
  });

  const rule = buildMockItem({ id: 'r-a', kind: 'rule' });
  const where = buildMockItem({ id: 'wh-a', kind: 'where', check: 'path:/srv/tide' });

  const lesson = {
    id: 'l-a',
    text: 'Reseed the table',
    why: 'A stale row passed',
    written: '2026-03-09T10:00:00Z',
    by: 'agent' as const,
  };

  const promise = {
    id: 'p-a',
    what: 'The cost table',
    to: 'sam',
    byWhen: 'Friday',
    written: '2026-03-09T10:00:00Z',
    by: 'owner' as const,
  };

  const words = {
    id: 'w-b',
    words: 'Keep PRs small',
    where: 'chat',
    written: '2026-03-09T10:00:00Z',
    by: 'owner' as const,
  };

  const decision = buildMockJournalRow({
    ts: '2026-03-09T10:00:00Z',
    op: 'decide',
    id: 'd-1',
    text: 'Use UTC',
    why: 'The feed sends UTC',
    extra: 'on=t-a;who=agent',
  });

  const pullRequest = {
    ref: 'bosunhq/bosun-app#9',
    opened: '2026-03-10T08:43:00Z',
    state: null,
    seen: null,
  };

  const brief = buildMockBriefInput({
    items: [task, wait, approval, rule, where],
    notes: [note],
    lessons: [lesson],
    promises: [promise],
    words: [words],
    pullRequests: [{ ref: pullRequest.ref, opened: pullRequest.opened, result: 'OPEN passing' }],
  });

  const expected: { readonly [Kind in ListKind]: ListJson & { readonly kind: Kind } } = {
    tasks: { ...jsonVersion, kind: 'tasks', rows: [{ kind: 'task', row: task, note }] },
    waits: { ...jsonVersion, kind: 'waits', rows: [{ kind: 'wait', row: wait, note: null }] },
    approvals: {
      ...jsonVersion,
      kind: 'approvals',
      rows: [{ kind: 'ok', row: approval, note: null }],
    },
    rules: { ...jsonVersion, kind: 'rules', rows: [{ kind: 'rule', row: rule, note: null }] },
    where: { ...jsonVersion, kind: 'where', rows: [{ kind: 'where', row: where, note: null }] },
    lessons: {
      ...jsonVersion,
      kind: 'lessons',
      rows: [{ kind: 'lesson', row: lesson, note: null }],
    },
    promises: {
      ...jsonVersion,
      kind: 'promises',
      rows: [{ kind: 'promise', row: promise, note: null }],
    },
    words: { ...jsonVersion, kind: 'words', rows: [{ kind: 'words', row: words, note: null }] },
    notes: { ...jsonVersion, kind: 'notes', rows: [note] },
    decisions: { ...jsonVersion, kind: 'decisions', rows: [decision] },
    prs: { ...jsonVersion, kind: 'prs', rows: [pullRequest] },
  };

  expect(
    ctx.buildListJSON(kind, { brief, prs: [pullRequest], decisionRows: [decision] }),
  ).toStrictEqual(expected[kind]);
});

test('it lists the notes of the open items, owed first, then the newest', () => {
  const ctx = setupTest();

  const brief = buildMockBriefInput({
    items: [buildMockItem({ id: 't-a' }), buildMockItem({ id: 't-b' })],
    notes: [
      buildMockNote({ id: 't-a', written: '2026-03-10T10:00:00Z' }),
      buildMockNote({ id: 't-b', owed: true, written: '2026-03-08T10:00:00Z' }),
      buildMockNote({ id: 't-gone', owed: true }),
    ],
  });

  const listed = ctx.buildListJSON('notes', { brief, prs: [], decisionRows: [] });

  expect(listed).toStrictEqual({
    ...jsonVersion,
    kind: 'notes',
    rows: [
      buildMockNote({ id: 't-b', owed: true, written: '2026-03-08T10:00:00Z' }),
      buildMockNote({ id: 't-a', written: '2026-03-10T10:00:00Z' }),
    ],
  });
});

test('it lists the decide row of each decision in force, and no replaced or ruled-out row', () => {
  const ctx = setupTest();
  const older = buildMockJournalRow({ ts: '2026-03-09T10:00:00Z', op: 'decide', id: 'd-1' });

  const kept = buildMockJournalRow({
    ts: '2026-03-10T10:00:00Z',
    op: 'decide',
    id: 'd-2',
    extra: 'replaces=d-1',
  });

  const ruledOut = buildMockJournalRow({ ts: '2026-03-10T11:00:00Z', op: 'ruled-out', id: 'd-3' });

  const listed = ctx.buildListJSON('decisions', {
    brief: buildMockBriefInput({}),
    prs: [],
    decisionRows: [older, kept, ruledOut],
  });

  expect(listed).toStrictEqual({ ...jsonVersion, kind: 'decisions', rows: [kept] });
});

test('it lists each of two decide rows that hold one id, as the text form lists them', () => {
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

  const listed = ctx.buildListJSON('decisions', {
    brief: buildMockBriefInput({}),
    prs: [],
    decisionRows: [first, second],
  });

  expect(listed).toStrictEqual({ ...jsonVersion, kind: 'decisions', rows: [second, first] });
});

test.each([['day 9' as const], ['worst case' as const]])(
  'it prints each kind of www list --json as its type for the %s store',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);

    const kinds = [
      'tasks',
      'waits',
      'approvals',
      'rules',
      'where',
      'lessons',
      'promises',
      'words',
      'notes',
      'decisions',
      'prs',
    ];

    const printed = await Promise.all(kinds.map((kind) => ctx.run(env, ['list', kind])));

    const results = printed.map((read) => jsonSchemas.list.safeParse(read.value).success);

    expect({
      exitCodes: printed.map((read) => read.exitCode),
      lines: printed.map((read) => read.lines),
      results,
    }).toStrictEqual({
      exitCodes: kinds.map(() => 0),
      lines: kinds.map(() => 1),
      results: kinds.map(() => true),
    });
  },
);

test('it prints the www list rules --json example of lists-and-json.md from the day 9 store', async () => {
  const ctx = setupTest();

  const env = await ctx.seed(ctx.root, 'day 9');

  const example = readDesignBlock('lists-and-json.md', '### --json', 'text');

  const printed = await ctx.run(env, ['list', 'rules']);

  expect(printed.stdout).toBe(`${example.split('\n')[1] ?? ''}\n`);
});
