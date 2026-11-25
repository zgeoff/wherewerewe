import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import type { JournalIndex, OwnerNote, SessionFile } from '../types.ts';
import { pickSay } from './pick-say.ts';

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
    pick: (
      argv: readonly string[],
      ownerNotes: readonly OwnerNote[],
      journal: Partial<JournalIndex>,
    ) =>
      pickSay({
        store: {
          folder: '/state/tide-alerts',
          session,
          items: [buildMockItem({ id: 't-a' })],
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
          pin: null,
          wordsUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: new Map([['t-done', '2026-03-05T08:00:00Z']]),
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
          lastOwnerNoteNumber: 0,
          ...journal,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
  };
}

test('it writes the first note as o-1, with a journal row by the owner and a reply', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['say', 'Ask me first'], [], {});
  const actual: unknown = picked.kind === 'write' ? picked.reply({ tokens: 8, limit: 8000 }) : null;

  expect([picked, actual]).toStrictEqual([
    {
      kind: 'write',
      change: {
        notes: [{ id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:43:00Z', on: null }],
        journal: [
          {
            ts: '2026-03-10T11:43:00Z',
            op: 'say',
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
    'o-1  owner note. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 8 of 8000 tokens.',
  ]);
});

test('it writes a note on an item with on= in the extra, and appends it to the shown notes', () => {
  const ctx = setupTest();
  const shown = { id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null };
  const picked = ctx.pick(['say', 'Use readings', '--on', 't-a'], [shown], {});
  const actual: unknown = picked.kind === 'write' ? picked.reply({ tokens: 9, limit: 8000 }) : null;

  expect([picked, actual]).toStrictEqual([
    {
      kind: 'write',
      change: {
        notes: [
          shown,
          { id: 'o-2', text: 'Use readings', said: '2026-03-10T11:43:00Z', on: 't-a' },
        ],
        journal: [
          {
            ts: '2026-03-10T11:43:00Z',
            op: 'say',
            id: 'o-2',
            by: 'owner',
            text: 'Use readings',
            why: null,
            extra: 'on=t-a',
          },
        ],
      },
      reply: expect.any(Function),
    },
    'o-2  owner note on t-a. It shows in every brief until you run: www --session tide-alerts ack o-2. Brief: 9 of 8000 tokens.',
  ]);
});

test.each([
  { title: 'an import said o-1 and none shows', notes: [], journal: 1, id: 'o-2' },
  { title: 'the highest note was acked', notes: [], journal: 5, id: 'o-6' },
  {
    title: 'a shown note is above the journal',
    notes: [{ id: 'o-9', text: 'x', said: '2026-03-10T11:00:00Z', on: null }],
    journal: 3,
    id: 'o-10',
  },
])('it numbers the note one past the highest used when $title', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(['say', 'Hello'], row.notes, { lastOwnerNoteNumber: row.journal });
  const actual = picked.kind === 'write' ? picked.change.journal[0]?.id : null;

  expect(actual).toBe(row.id);
});

test.each([
  {
    title: 'an empty text',
    argv: ['say', ''],
    notes: [],
    line: 'www: refused: the owner note is empty.',
  },
  {
    title: 'a lone dash',
    argv: ['say', '-'],
    notes: [],
    line: 'www: refused: the owner note is empty.',
  },
  {
    title: 'a tab',
    argv: ['say', 'a\tb'],
    notes: [],
    line: 'www: refused: the text must be one line, with no tab or newline.',
  },
  {
    title: 'a newline',
    argv: ['say', 'a\nb'],
    notes: [],
    line: 'www: refused: the text must be one line, with no tab or newline.',
  },
  {
    title: 'a text of 161 characters',
    argv: ['say', 'n'.repeat(161)],
    notes: [],
    line: 'www: refused: the owner note is 161 characters, and the limit is 160. Write what is true now; the story belongs in a PR or a commit.',
  },
  {
    title: 'a credential',
    argv: ['say', `Use AKIA${'Q'.repeat(16)} to deploy`],
    notes: [],
    line: expect.stringContaining('www: refused: the text looks like a credential'),
  },
  {
    title: 'an item that is neither open nor closed',
    argv: ['say', 'Hello', '--on', 't-none'],
    notes: [],
    line: 'www: refused: no open item t-none. Open items: t-a.',
  },
  {
    title: 'a closed decision id, which owner.tsv cannot hold',
    argv: ['say', 'Hello', '--on', 'd-1'],
    notes: [],
    journal: { closed: new Map([['d-1', '2026-03-05T08:00:00Z']]) },
    line: 'www: refused: no open item d-1. Open items: t-a.',
  },
  {
    title: 'two notes already showing',
    argv: ['say', 'Hello'],
    notes: [
      { id: 'o-4', text: 'x', said: '2026-03-10T11:00:00Z', on: null },
      { id: 'o-5', text: 'y', said: '2026-03-10T11:01:00Z', on: null },
    ],
    line: 'www: refused: 2 owner notes already show. Clear one that is done.',
  },
])('it refuses $title', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(row.argv, row.notes, row.journal ?? {});

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({ exitCode: 3, lines: [row.line] }),
  });
});

test('it takes a closed item as --on', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['say', 'Hello', '--on', 't-done'], [], {});

  expect(picked.kind).toBe('write');
});

test('it refuses once the note numbers are used up, so no two notes share an id', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['say', 'Hello'], [], { lastOwnerNoteNumber: Number.MAX_SAFE_INTEGER });

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({
      exitCode: 3,
      lines: ['www: refused: owner note numbers are used up after o-9007199254740991.'],
      runs: [{ www: ['log', '--op', 'say'] }],
    }),
  });
});
