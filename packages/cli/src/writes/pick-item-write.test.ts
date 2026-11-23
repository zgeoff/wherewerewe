import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildOkArgv } from '../test-utils/build-ok-argv.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Item, SessionFile } from '../types.ts';
import { pickItemWrite } from './pick-item-write.ts';

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
    pick: (argv: readonly string[], items: readonly Item[]) =>
      pickItemWrite({
        store: { folder: '/state/tide-alerts', session, items },
        journal: { closed: new Map(), decisions: new Map(), lastDecisionNumber: 0 },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
      }),
  };
}

test('it writes an approval as an item that keeps the quote as its claim and the parts in its extra', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv('--once'), []);

  expect(picked).toStrictEqual({
    kind: 'write',
    change: {
      items: [
        {
          id: 'ok-merge',
          kind: 'ok',
          claim: 'merge the alert PRs yourself',
          check: null,
          atWrite: null,
          last: null,
          written: '2026-03-10T11:43:00Z',
          by: 'agent',
          extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
        },
      ],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'ok',
          id: 'ok-merge',
          by: 'agent',
          text: 'merge the alert PRs yourself',
          why: null,
          extra: 'use=once',
        },
      ],
    },
    reply: expect.any(Function),
  });
});

test('it journals use=standing for a standing approval', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv('--standing'), []);

  expect(picked).toMatchObject({
    kind: 'write',
    change: { journal: [{ extra: 'use=standing' }] },
  });
});

test('it replaces the whole item of an open approval with the same id', () => {
  const ctx = setupTest();

  const old = buildMockItem({
    id: 'ok-merge',
    kind: 'ok',
    claim: 'the old words',
    extra: { who: 'sam', where: 'chat', scope: 'old', use: 'standing' },
  });

  const picked = ctx.pick(buildOkArgv('--once'), [old]);

  expect(picked).toMatchObject({
    kind: 'write',
    change: {
      items: [
        {
          id: 'ok-merge',
          claim: 'merge the alert PRs yourself',
          extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
        },
      ],
    },
  });
});

test('it replies with the approval as ok, open, with no check', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv('--once'), []);

  expect(getPickedWrite(picked, 9).reply).toBe('ok-merge  ok, open, no check. Brief: 9 lines.');
});

test('it refuses a fourth approval and names the oldest to drop', () => {
  const ctx = setupTest();
  const full = ['ok-a', 'ok-b', 'ok-c'].map((id) => buildMockItem({ id, kind: 'ok' }));
  const picked = ctx.pick(buildOkArgv('--once'), full);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        'www: refused: the brief holds 3 of 3 approvals. Close one, or replace one with www set.',
      ],
      runs: [{ www: ['drop', 'ok-a', '--why', '<reason>'] }],
    },
  });
});

test('it replaces an open approval when three approvals are open', () => {
  const ctx = setupTest();
  const full = ['ok-a', 'ok-b', 'ok-merge'].map((id) => buildMockItem({ id, kind: 'ok' }));
  const picked = ctx.pick(buildOkArgv('--once'), full);

  expect(picked.kind).toBe('write');
});

test.each([
  ['no --quote', ['ok', 'ok-a', '--who', 'o', '--where', 'w', '--scope', 's', '--once']],
  ['no --who', ['ok', 'ok-a', '--quote', 'q', '--where', 'w', '--scope', 's', '--once']],
  ['no --where', ['ok', 'ok-a', '--quote', 'q', '--who', 'o', '--scope', 's', '--once']],
  ['no --scope', ['ok', 'ok-a', '--quote', 'q', '--who', 'o', '--where', 'w', '--once']],
  [
    'neither --once nor --standing',
    ['ok', 'ok-a', '--quote', 'q', '--who', 'o', '--where', 'w', '--scope', 's'],
  ],
  [
    'both --once and --standing',
    [
      'ok',
      'ok-a',
      '--quote',
      'q',
      '--who',
      'o',
      '--where',
      'w',
      '--scope',
      's',
      '--once',
      '--standing',
    ],
  ],
])('it refuses an approval with %s as lacking a part', (_title, argv) => {
  const ctx = setupTest();
  const picked = ctx.pick(argv, []);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({
      exitCode: 3,
      lines: [
        "www: refused: an approval needs the owner's exact words, who gave them, where, what they cover, and --once or --standing.",
      ],
    }),
  });
});

test.each([
  ['quote', 'a'.repeat(120), 'write'],
  ['quote', 'a'.repeat(121), 'refused'],
  ['who', 'a'.repeat(16), 'write'],
  ['who', 'a'.repeat(17), 'refused'],
  ['where', 'a'.repeat(16), 'write'],
  ['where', 'a'.repeat(17), 'refused'],
  ['scope', 'a'.repeat(40), 'write'],
  ['scope', 'a'.repeat(41), 'refused'],
  ['who', 'a;b', 'refused'],
  ['where', 'a=b', 'refused'],
  ['scope', 'a;b=c', 'refused'],
] as const)('it takes a --%s of %p as %s', (flag, value, kind) => {
  const ctx = setupTest();

  const argv = [
    'ok',
    'ok-a',
    '--quote',
    flag === 'quote' ? value : 'q',
    '--who',
    flag === 'who' ? value : 'o',
    '--where',
    flag === 'where' ? value : 'w',
    '--scope',
    flag === 'scope' ? value : 's',
    '--once',
  ];

  const picked = ctx.pick(argv, []);

  expect(picked.kind).toBe(kind);
});

test('it journals the check of a set on an approval beside its use', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['set', 'ok-merge', 'Updated quote', '--pid', '123'],
    [
      buildMockItem({
        id: 'ok-merge',
        kind: 'ok',
        claim: 'merge the alert PRs yourself',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api', use: 'once' },
      }),
    ],
  );

  expect(picked).toMatchObject({
    kind: 'write',
    change: {
      items: [{ id: 'ok-merge', check: 'pid:123' }],
      journal: [{ op: 'set', id: 'ok-merge', extra: 'use=once;check=pid:123' }],
    },
  });
});
