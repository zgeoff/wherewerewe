import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { JournalIndex, SessionFile } from '../types.ts';
import { pickDecision } from './pick-decision.ts';

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
    pick: (argv: readonly string[], journal: Partial<JournalIndex>) =>
      pickDecision({
        store: {
          folder: '/state/tide-alerts',
          session,
          items: [buildMockItem({ id: 't-a' })],
          ownerNotes: [],
          notes: [],
          notesUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: new Map(),
          decisions: new Map(),
          lastDecisionNumber: 0,
          lastOwnerNoteNumber: 0,
          ...journal,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
      }),
  };
}

test('it numbers the first decision d-1 and writes only the journal row and the session', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'], {});

  expect(getPickedWrite(picked, 7).change).toStrictEqual({
    session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
    journal: [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'decide',
        id: 'd-1',
        by: 'agent',
        text: 'Retry a 503 3 times',
        why: 'The feed flaps',
        extra: 'who=agent',
      },
    ],
  });
});

test('it numbers a decision one past the highest in the journal', () => {
  const ctx = setupTest();

  const picked = ctx.pick(['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'], {
    lastDecisionNumber: 12,
  });

  expect(getPickedWrite(picked, 7).change.journal).toMatchObject([{ id: 'd-13' }]);
});

test('it numbers the decision at the last safe integer and refuses the one after it', () => {
  const ctx = setupTest();
  const argv = ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'];
  const last = Number.MAX_SAFE_INTEGER;
  const atEdge = ctx.pick(argv, { lastDecisionNumber: last - 1 });
  const pastEdge = ctx.pick(argv, { lastDecisionNumber: last });

  expect([getPickedWrite(atEdge, 7).change.journal, pastEdge]).toStrictEqual([
    [expect.objectContaining({ id: `d-${String(last)}` })],
    {
      kind: 'refused',
      refusal: expect.objectContaining({
        exitCode: 3,
        lines: [`www: refused: decision numbers are used up after d-${String(last)}.`],
      }),
    },
  ]);
});

test('it writes a ruled-out row for --ruled-out', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['decide', 'Poll every minute', '--why', 'Too slow', '--ruled-out'], {});

  expect(getPickedWrite(picked, 7).change.journal).toMatchObject([{ op: 'ruled-out' }]);
});

test.each([
  {
    title: 'an open item',
    argv: ['decide', 'Retry', '--why', 'Flaps', '--on', 't-a'],
    journal: {},
    extra: 'on=t-a;who=agent',
    reply: 'd-1  decision on t-a. Read it with: www show t-a. Brief: 7 lines.',
  },
  {
    title: 'a closed id',
    argv: ['decide', 'Retry', '--why', 'Flaps', '--on', 't-old'],
    journal: { closed: new Map([['t-old', '2026-03-05T08:00:00Z']]) },
    extra: 'on=t-old;who=agent',
    reply: 'd-1  decision on t-old. Read it with: www show t-old. Brief: 7 lines.',
  },
  {
    title: 'no item, as the owner',
    argv: ['decide', 'Retry', '--why', 'Flaps', '--who', 'owner'],
    journal: {},
    extra: 'who=owner',
    reply: 'd-1  decision. Read it with: www show d-1. Brief: 7 lines.',
  },
  {
    title: 'a decision of the agent that it replaces',
    argv: ['decide', 'Retry', '--why', 'Flaps', '--on', 't-a', '--replaces', 'd-2'],
    journal: { decisions: new Map([['d-2', { who: 'agent' as const }]]), lastDecisionNumber: 2 },
    extra: 'on=t-a;who=agent;replaces=d-2',
    reply: 'd-3  decision on t-a. Read it with: www show t-a. Brief: 7 lines.',
  },
  {
    title: 'a decision of the owner that it replaces, as the owner',
    argv: ['decide', 'Retry', '--why', 'Flaps', '--who', 'owner', '--replaces', 'd-2'],
    journal: { decisions: new Map([['d-2', { who: 'owner' as const }]]), lastDecisionNumber: 2 },
    extra: 'who=owner;replaces=d-2',
    reply: 'd-3  decision. Read it with: www show d-3. Brief: 7 lines.',
  },
  {
    title: 'a ruled-out approach on an open item',
    argv: ['decide', 'Poll', '--why', 'Slow', '--ruled-out', '--on', 't-a'],
    journal: {},
    extra: 'on=t-a;who=agent',
    reply: 'd-1  ruled out on t-a. Read it with: www show t-a. Brief: 7 lines.',
  },
])('it writes the extra and the reply for $title', (row) => {
  const ctx = setupTest();
  const written = getPickedWrite(ctx.pick(row.argv, row.journal), 7);

  expect({ extra: written.change.journal[0]?.extra, reply: written.reply }).toStrictEqual({
    extra: row.extra,
    reply: row.reply,
  });
});

test.each([
  ['no --why', ['decide', 'Retry'], {}, 'www: refused: a decision needs its reason.'],
  [
    'a --who that is not owner or agent',
    ['decide', 'Retry', '--why', 'x', '--who', 'sam'],
    {},
    'www: refused: --who on a decision is owner or agent.',
  ],
  [
    'an --on that names no item',
    ['decide', 'Retry', '--why', 'x', '--on', 't-zz'],
    {},
    'www: refused: no open item t-zz. Open items: t-a.',
  ],
  [
    'a --replaces that names no decision',
    ['decide', 'Retry', '--why', 'x', '--replaces', 'd-4'],
    {},
    'www: refused: there is no decision d-4; there are no decisions yet.',
  ],
  [
    'a --replaces that names the owner decision, with no --who owner',
    ['decide', 'Retry', '--why', 'x', '--replaces', 'd-4'],
    { decisions: new Map([['d-4', { who: 'owner' as const }]]), lastDecisionNumber: 4 },
    "www: refused: d-4 is the owner's decision, so only a decision recorded with --who owner replaces it.",
  ],
])('it refuses %s', (_title, argv, journal, line) => {
  const ctx = setupTest();
  const picked = ctx.pick(argv, journal);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({ exitCode: 3, lines: [line] }),
  });
});
