import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import type { OwnerNote, SessionFile } from '../types.ts';
import { pickAck } from './pick-ack.ts';

function setupTest() {
  const session: SessionFile = {
    format: '2',
    grant: null,
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
    pick: (argv: readonly string[], ownerNotes: readonly OwnerNote[]) =>
      pickAck({
        store: {
          folder: '/state/tide-alerts',
          session,
          items: [],
          ownerNotes,
          notes: [],
          notesUnread: null,
          prs: [],
          prsUnread: null,
          lessons: [],
          lessonsUnread: null,
          promises: [],
          promisesUnread: null,
          words: [],
          wordsUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: new Map(),
          lastRows: {
            items: new Map(),
            lesson: new Map(),
            promise: new Map(),
            words: new Map(),
          },
          decisions: new Map(),
          lastDecisionNumber: 0,
          replaced: new Set(),
          inForce: [],
          lastOwnerNoteNumber: 2,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
  };
}

test('it removes the note, writes an ack row with its text, and replies', () => {
  const ctx = setupTest();
  const first = { id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null };
  const second = { id: 'o-2', text: 'Use readings', said: '2026-03-10T11:05:00Z', on: 't-a' };
  const picked = ctx.pick(['ack', 'o-1'], [first, second]);

  const actual: unknown =
    picked.kind === 'write' ? picked.reply({ tokens: 10, limit: 8000 }) : null;

  expect([picked, actual]).toStrictEqual([
    {
      kind: 'write',
      change: {
        notes: [second],
        journal: [
          {
            ts: '2026-03-10T11:43:00Z',
            op: 'ack',
            id: 'o-1',
            by: 'owner',
            text: 'Ask me first',
            why: null,
            extra: null,
          },
        ],
      },
      reply: expect.any(Function),
    },
    'o-1  cleared. Kept in the journal. Brief: 10 of 8000 tokens.',
  ]);
});

test.each([
  {
    title: 'an id that no note has',
    argv: ['ack', 'o-7'],
    notes: [{ id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null }],
    line: 'www: refused: no owner note o-7 shows. Owner notes: o-1.',
  },
  {
    title: 'no note at all',
    argv: ['ack', 'o-1'],
    notes: [],
    line: 'www: refused: no owner note o-1 shows. Owner notes: none.',
  },
])('it refuses $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.argv, row.notes)).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({ exitCode: 3, lines: [row.line] }),
  });
});
