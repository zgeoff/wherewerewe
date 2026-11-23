import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Item, SessionFile } from '../types.ts';
import { pickClose } from './pick-close.ts';

function setupTest() {
  return {
    pick: (
      argv: readonly string[],
      items: readonly Item[],
      now: string | null,
      closed: ReadonlyMap<string, string> = new Map(),
    ) => {
      const session: SessionFile = {
        format: '1',
        name: 'tide-alerts',
        goal: 'Ship it',
        started: '2026-03-02T08:04:11Z',
        now,
        nowNext: now === null ? null : 'go',
        nowSet: now === null ? null : '2026-03-10T10:00:00Z',
        lastWrite: null,
        lastNudge: null,
        importedFrom: null,
      };

      return pickClose({
        store: { folder: '/state/tide-alerts', session, items },
        journal: { closed, decisions: new Map(), lastDecisionNumber: 0 },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
      });
    },
  };
}

test('it spends a once approval: the item leaves, and the journal keeps its quote and what it was used for', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', 'wiped it'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
  );

  expect(picked).toStrictEqual({
    kind: 'write',
    change: {
      items: [],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z', now: null }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'use',
          id: 'ok-wipe',
          by: 'agent',
          text: 'wipe the staging tmp dir',
          why: 'wiped it',
          extra: null,
        },
      ],
    },
    reply: expect.any(Function),
  });
});

test('it replies that the approval is used, and off the brief', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', 'wiped it'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
  );

  expect(getPickedWrite(picked, 6).reply).toBe(
    'ok-wipe  used. Off the brief, kept in the journal. Brief: 6 lines.',
  );
});

test('it clears the focus when the spent approval was in it', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', 'wiped it'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    'ok-wipe',
  );

  expect(picked).toMatchObject({
    kind: 'write',
    change: { session: { now: null, nowNext: null, nowSet: null } },
  });
});

test('it leaves the focus on another item alone', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', 'wiped it'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
      buildMockItem({ id: 't-a' }),
    ],
    't-a',
  );

  expect(picked).toMatchObject({ kind: 'write', change: { session: { now: 't-a' } } });
});

test.each([
  [
    'a standing approval',
    [buildMockItem({ id: 'ok-wipe', kind: 'ok', extra: { use: 'standing' } })],
    'www: refused: ok-wipe is standing, so there is nothing to spend. Act inside its quote and scope.',
  ],
  [
    'a task',
    [buildMockItem({ id: 'ok-wipe' })],
    'www: refused: ok-wipe is a task, and use spends a --once approval.',
  ],
  [
    'a rule',
    [buildMockItem({ id: 'ok-wipe', kind: 'rule' })],
    'www: refused: ok-wipe is a rule, and use spends a --once approval.',
  ],
  ['no open item', [], 'www: refused: no open item ok-wipe. Open items: none.'],
])('it refuses use on %s', (_title, items, line) => {
  const ctx = setupTest();
  const picked = ctx.pick(['use', 'ok-wipe', '--for', 'wiped it'], items, null);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({ exitCode: 3, lines: [line] }),
  });
});

test('it suggests no spent approval for an unknown use id, and reads the id when none is left', () => {
  const ctx = setupTest();

  const spent = buildMockItem({
    id: 'ok-a',
    kind: 'ok',
    extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
  });

  const closed = new Map([['ok-a', '2026-03-10T10:00:00Z']]);

  const withSpare = ctx.pick(
    ['use', 'ok-z', '--for', 'checked'],
    [
      spent,
      buildMockItem({
        id: 'ok-b',
        kind: 'ok',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
    closed,
  );

  const withTask = ctx.pick(
    ['use', 'ok-z', '--for', 'checked'],
    [spent, buildMockItem({ id: 't-a' })],
    null,
    closed,
  );

  expect([withSpare, withTask]).toStrictEqual([
    {
      kind: 'refused',
      refusal: expect.objectContaining({
        lines: ['www: refused: no open item ok-z. Open items: ok-a, ok-b.'],
        runs: [{ www: ['use', 'ok-b', '--for', 'checked'] }],
      }),
    },
    {
      kind: 'refused',
      refusal: expect.objectContaining({
        lines: ['www: refused: no open item ok-z. Open items: ok-a, t-a.'],
        runs: [{ www: ['show', 'ok-z'] }],
      }),
    },
  ]);
});

test('it refuses use with no --for', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
  );

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({
      exitCode: 3,
      lines: ['www: refused: use needs what you did with it.'],
    }),
  });
});

test.each([
  ['at its limit', 'f'.repeat(200), 'write'],
  ['over its limit', 'f'.repeat(201), 'refused'],
  ['of one dash', '-', 'refused'],
  ['with a tab', 'a\tb', 'refused'],
] as const)('it takes a --for text %s as %s', (_title, text, kind) => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', text],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
  );

  expect(picked.kind).toBe(kind);
});

test('it finishes the rewrite of an approval whose use row is already in the journal, with no second row', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['use', 'ok-wipe', '--for', 'wiped it'],
    [
      buildMockItem({
        id: 'ok-wipe',
        kind: 'ok',
        claim: 'wipe the staging tmp dir',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
    null,
    new Map([['ok-wipe', '2026-03-10T11:40:00Z']]),
  );

  expect(picked).toStrictEqual({
    kind: 'write',
    change: {
      items: [],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [],
    },
    reply: expect.any(Function),
  });
});
