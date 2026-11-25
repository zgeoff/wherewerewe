import { expect, test } from 'bun:test';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Item, LastJournalRow, Note, SessionFile } from '../types.ts';
import { pickClose } from './pick-close.ts';

interface PickOptions {
  readonly closed?: ReadonlyMap<string, string>;
  readonly lastItemRows?: ReadonlyMap<string, LastJournalRow>;
  readonly notes?: readonly Note[];
}

function setupTest() {
  return {
    pick: (
      argv: readonly string[],
      items: readonly Item[],
      now: string | null,
      options: PickOptions = {},
    ) => {
      const session: SessionFile = {
        format: '2',
        grant: null,
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
        store: {
          folder: '/state/tide-alerts',
          session,
          items,
          ownerNotes: [],
          notes: options.notes ?? [],
          notesUnread: null,
          prs: [],
          prsUnread: null,
          lessons: [],
          lessonsUnread: null,
          promises: [],
          promisesUnread: null,
          words: [],
          pin: null,
          wordsUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: options.closed ?? new Map(),
          lastRows: {
            items: options.lastItemRows ?? new Map(),
            lesson: new Map(),
            promise: new Map(),
            words: new Map(),
          },
          decisions: new Map(),
          lastDecisionNumber: 0,
          replaced: new Set(),
          inForce: [],
          lastOwnerNoteNumber: 0,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
      }),
    ],
    null,
  );

  expect(getPickedWrite(picked, 6).reply).toBe(
    'ok-wipe  used. Off the brief, kept in the journal. Brief: 6 of 8000 tokens.',
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
      }),
      buildMockItem({ id: 't-a' }),
    ],
    't-a',
  );

  expect(picked).toMatchObject({ kind: 'write', change: { session: { now: 't-a' } } });
});

test.each([
  [
    'a task',
    [buildMockItem({ id: 'ok-wipe' })],
    'www: refused: ok-wipe is a task, and use spends the one-time approval.',
  ],
  [
    'a rule',
    [buildMockItem({ id: 'ok-wipe', kind: 'rule' })],
    'www: refused: ok-wipe is a rule, and use spends the one-time approval.',
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
    extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
  });

  const closed = new Map([['ok-a', '2026-03-10T10:00:00Z']]);

  const withSpare = ctx.pick(
    ['use', 'ok-z', '--for', 'checked'],
    [
      spent,
      buildMockItem({
        id: 'ok-b',
        kind: 'ok',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
      }),
    ],
    null,
    { closed },
  );

  const withTask = ctx.pick(
    ['use', 'ok-z', '--for', 'checked'],
    [spent, buildMockItem({ id: 't-a' })],
    null,
    { closed },
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
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
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
      }),
    ],
    null,
    {
      closed: new Map([['ok-wipe', '2026-03-10T11:40:00Z']]),
      lastItemRows: new Map([['ok-wipe', { op: 'use', text: 'wipe the staging tmp dir' }]]),
    },
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

test.each([
  ['done', ['done', 't-a', '--evidence', 'commit 4c1d2e0'], 'done.'],
  ['drop', ['drop', 't-a', '--why', 'stopped'], 'dropped.'],
])(
  'it removes the notes.tsv row of an item that %s closes, and prints the note whole',
  (_title, argv, verb) => {
    const ctx = setupTest();

    const picked = getPickedWrite(
      ctx.pick(argv, [buildMockItem({ id: 't-a' })], null, {
        notes: [buildMockNote({ id: 't-a' })],
      }),
      6,
    );

    expect(picked).toStrictEqual({
      change: {
        items: [],
        notes: [],
        session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
        journal: [expect.objectContaining({ id: 't-a' })],
      },
      reply: `    The simulator is shared on Fridays\nt-a  ${verb} Off the brief, kept in the journal with its note (1h). Brief: 6 of 8000 tokens.`,
    });
  },
);

test('it prints the note of a spent approval after used.', () => {
  const ctx = setupTest();

  const approval = buildMockItem({
    id: 'ok-wipe',
    kind: 'ok',
    claim: 'wipe it',
    extra: { who: 'owner', where: 'terminal', scope: 'api' },
  });

  const picked = getPickedWrite(
    ctx.pick(['use', 'ok-wipe', '--for', 'wiped'], [approval], null, {
      notes: [buildMockNote({ id: 'ok-wipe' })],
    }),
    6,
  );

  expect(picked.reply).toBe(
    '    The simulator is shared on Fridays\nok-wipe  used. Off the brief, kept in the journal with its note (1h). Brief: 6 of 8000 tokens.',
  );
});

test('it leaves notes out of the change when the closed item had no note', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(
      ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
      [buildMockItem({ id: 't-a' })],
      null,
      { notes: [] },
    ),
    6,
  );

  expect(picked.change).not.toHaveProperty('notes');
});

test('it removes the note row when it finishes a close the journal already holds', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(
      ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
      [buildMockItem({ id: 't-a' })],
      null,
      {
        notes: [buildMockNote({ id: 't-a' })],
        closed: new Map([['t-a', '2026-03-10T11:00:00Z']]),
        lastItemRows: new Map([['t-a', { op: 'done', text: 'Write the parser' }]]),
      },
    ),
    6,
  );

  expect(picked.change).toStrictEqual({
    items: [],
    notes: [],
    session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
    journal: [],
  });
});

test.each([
  ['done', ['done', 't-a', '--evidence', 'commit 4c1d2e0']],
  ['drop', ['drop', 't-a', '--why', 'stopped']],
])('it refuses %s while the note is owed and prints the note', (_title, argv) => {
  const ctx = setupTest();

  const picked = ctx.pick(argv, [buildMockItem({ id: 't-a' })], null, {
    notes: [buildMockNote({ id: 't-a', owed: true })],
  });

  expect(picked.kind === 'refused' && picked.refusal).toStrictEqual({
    exitCode: 3,
    lines: [
      'www: refused: t-a has an owed note (1h). Clear it once the work is done, or replace it with a note that is not owed.',
      '    The simulator is shared on Fridays',
    ],
    runs: [
      { www: ['set', 't-a', '--no-note'] },
      { www: ['set', 't-a', '--note', toPlaceholder('<detail>')] },
    ],
  });
});

test('it refuses use on an owed note after its own checks', () => {
  const ctx = setupTest();

  const approval = buildMockItem({
    id: 'ok-wipe',
    kind: 'ok',
    claim: 'wipe it',
    extra: { who: 'owner', where: 'terminal', scope: 'api' },
  });

  const picked = ctx.pick(['use', 'ok-wipe', '--for', 'wiped'], [approval], null, {
    notes: [buildMockNote({ id: 'ok-wipe', owed: true })],
  });

  expect(picked.kind === 'refused' && picked.refusal.lines[0]).toBe(
    'www: refused: ok-wipe has an owed note (1h). Clear it once the work is done, or replace it with a note that is not owed.',
  );
});

test.each([
  {
    title: 'a task write of the id followed its interrupted done',
    lastItemRows: new Map([['t-a', { op: 'task', text: 'Write the parser' }]]),
  },
  {
    title: 'the done of the id closed a lesson, not this task',
    lastItemRows: new Map<string, LastJournalRow>(),
  },
  {
    title: 'its newest close of the id is a drop',
    lastItemRows: new Map([['t-a', { op: 'drop', text: 'Write the parser' }]]),
  },
])('it records the done of a task whose id the journal closed when $title', (row) => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(
      ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
      [buildMockItem({ id: 't-a' })],
      null,
      {
        closed: new Map([['t-a', '2026-03-10T11:43:00Z']]),
        lastItemRows: row.lastItemRows,
      },
    ),
    6,
  );

  expect(picked.change.journal).toStrictEqual([
    {
      ts: '2026-03-10T11:43:00Z',
      op: 'done',
      id: 't-a',
      by: 'agent',
      text: 'Write the parser',
      why: 'commit 4c1d2e0',
      extra: null,
    },
  ]);
});
