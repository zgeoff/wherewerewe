import { expect, test } from 'bun:test';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Grant } from '../types.ts';
import { pickGrantWrite } from './pick-grant-write.ts';

function setupTest() {
  const grant: Grant = {
    words: 'Merge the alert PRs yourself.',
    reading: 'covers merges',
    where: 'terminal',
    set: '2026-03-03T09:00:00Z',
  };

  return {
    grant,
    pick: (argv: readonly string[], options: { byOwner?: boolean; grant?: Grant | null } = {}) =>
      pickGrantWrite({
        store: {
          folder: '/state/tide-alerts',
          session: buildMockSession({ grant: options.grant ?? null }),
          items: [],
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
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        byOwner: options.byOwner ?? false,
      }),
    readRefusal: (picked: ReturnType<typeof pickGrantWrite>) =>
      picked.kind === 'refused' ? picked.refusal : null,
  };
}

test('it writes the words, the reading and where, with a journal row by the agent', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--quote',
      'Merge the alert PRs yourself.',
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ]),
    9,
  );

  expect(picked).toStrictEqual({
    change: {
      session: buildMockSession({
        grant: {
          words: 'Merge the alert PRs yourself.',
          reading: 'covers merges',
          where: 'chat',
          set: '2026-03-10T11:43:00Z',
        },
        lastWrite: '2026-03-10T11:43:00Z',
      }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'grant',
          id: 'grant',
          by: 'agent',
          text: 'Merge the alert PRs yourself.',
          why: 'covers merges',
          extra: 'where=chat',
        },
      ],
    },
    reply: 'grant: 29 of 700 characters, reading 13 of 200. Brief: 9 lines.',
  });
});

test('it writes the journal row by the owner when the owner-terminal test passes', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--quote', 'Go.', '--where', 'chat', '--reading', 'all of it'], {
      byOwner: true,
    }),
    9,
  );

  expect(picked.change.journal.map((row) => row.by)).toStrictEqual(['owner']);
});

test('it replaces only the reading with --reading alone, and keeps the words, where and set', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--reading', 'covers merges and nothing else'], { grant: ctx.grant }),
    9,
  );

  expect({
    grant: picked.change.session?.grant,
    journal: picked.change.journal,
    reply: picked.reply,
  }).toStrictEqual({
    grant: {
      words: 'Merge the alert PRs yourself.',
      reading: 'covers merges and nothing else',
      where: 'terminal',
      set: '2026-03-03T09:00:00Z',
    },
    journal: [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'Merge the alert PRs yourself.',
        why: 'covers merges and nothing else',
        extra: 'where=terminal;reading=1',
      },
    ],
    reply: 'grant reading: 30 of 200. Brief: 9 lines.',
  });
});

test.each([
  { title: 'a line feed', separator: '\n' },
  { title: 'a carriage return and a line feed', separator: '\r\n' },
  { title: 'a lone carriage return', separator: '\r' },
])('it turns $title in the words into one space before it counts', (row) => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--quote',
      `${'a'.repeat(350)}${row.separator}${'b'.repeat(349)}`,
      '--where',
      'chat',
      '--reading',
      'r',
    ]),
    9,
  );

  expect(picked.change.session?.grant?.words).toBe(`${'a'.repeat(350)} ${'b'.repeat(349)}`);
});

test('it refuses 701 code points once the line breaks are spaces, and takes 700', () => {
  const ctx = setupTest();

  const over = ctx.pick([
    'grant',
    '--quote',
    `${'a'.repeat(350)}\n${'b'.repeat(350)}`,
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  const exact = ctx.pick([
    'grant',
    '--quote',
    `${'a'.repeat(350)}\r\n${'b'.repeat(349)}`,
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect([ctx.readRefusal(over)?.lines[0], exact.kind]).toStrictEqual([
    "www: refused: the grant's words are 701 characters, and the limit is 700. The grant holds the owner's words whole, so it takes a statement of at most 700 characters.",
    'write',
  ]);
});

test('it counts code points, so 700 astral characters pass', () => {
  const ctx = setupTest();

  const picked = ctx.pick([
    'grant',
    '--quote',
    '\u{1F331}'.repeat(700),
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect(picked.kind).toBe('write');
});

test.each([
  {
    title: 'no flag',
    argv: ['grant'],
    line: "www: refused: a grant needs the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'only --quote',
    argv: ['grant', '--quote', 'Go.'],
    line: "www: refused: a grant needs the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'only --where',
    argv: ['grant', '--where', 'chat'],
    line: "www: refused: a grant needs the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: '--reading alone, with no grant to read',
    argv: ['grant', '--reading', 'covers merges'],
    line: 'www: refused: tide-alerts has no grant, so there is no reading to replace.',
  },
  {
    title: 'a reading of 201 characters',
    argv: ['grant', '--quote', 'Go.', '--where', 'chat', '--reading', 'r'.repeat(201)],
    line: 'www: refused: the reading is 201 characters, and the limit is 200.',
  },
  {
    title: 'a where of 17 characters',
    argv: ['grant', '--quote', 'Go.', '--where', 'w'.repeat(17), '--reading', 'r'],
    line: 'www: refused: the where is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.',
  },
  {
    title: 'a where with a semicolon',
    argv: ['grant', '--quote', 'Go.', '--where', 'chat;x', '--reading', 'r'],
    line: 'www: refused: --where cannot hold ; or =.',
  },
])('it refuses $title', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(row.argv);

  expect(ctx.readRefusal(picked)?.lines[0]).toBe(row.line);
});

test.each([
  { title: 'the words', flag: '--quote', other: '--reading', otherValue: 'r' },
  { title: 'the reading', flag: '--reading', other: '--quote', otherValue: 'Go.' },
])('it refuses a credential in $title', (row) => {
  const ctx = setupTest();
  const prefix = ['ghp', '_'].join('');
  const secret = [prefix, 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('');

  const picked = ctx.pick([
    'grant',
    row.flag,
    `token ${secret}`,
    row.other,
    row.otherValue,
    '--where',
    'chat',
  ]);

  expect(ctx.readRefusal(picked)?.lines).toStrictEqual([
    `www: refused: the text looks like a credential (it matches ${prefix}). Write where the secret lives, never its value.`,
  ]);
});
