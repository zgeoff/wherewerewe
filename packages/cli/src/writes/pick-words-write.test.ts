import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Store, WordsRow } from '../types.ts';
import { pickWordsWrite } from './pick-words-write.ts';

function setupTest() {
  return {
    argv: ['words', 'w-plain', 'Plain words in every reply', '--where', 'chat'],
    pick: (argv: readonly string[], byOwner: boolean, store: Partial<Store> = {}) =>
      pickWordsWrite({
        store: buildMockStore(store),
        journal: buildMockJournalIndex({}),
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
        byOwner,
      }),
    words: (id: string, written = '2026-03-04T09:00:00Z'): WordsRow => ({
      id,
      words: 'Old',
      where: 'chat',
      written,
      by: 'owner',
    }),
  };
}

test.each([
  { title: 'the owner terminal', byOwner: true, by: 'owner' },
  { title: 'an agent', byOwner: false, by: 'agent' },
] as const)('it writes the row and the journal row with by set to $by for $title', (row) => {
  const ctx = setupTest();
  const picked = getPickedWrite(ctx.pick(ctx.argv, row.byOwner), 7);

  expect(picked).toStrictEqual({
    change: {
      words: [
        {
          id: 'w-plain',
          words: 'Plain words in every reply',
          where: 'chat',
          written: '2026-03-10T11:43:00Z',
          by: row.by,
        },
      ],
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'words',
          id: 'w-plain',
          by: row.by,
          text: 'Plain words in every reply',
          why: null,
          extra: 'where=chat',
        },
      ],
    },
    reply: "w-plain  owner's words, open, 26 of 300. Brief: 7 of 8000 tokens.",
  });
});

test('it refuses no --where and keeps a placeholder for the words, never a copy of them', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['words', 'w-plain', 'Plain words'], false);

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    ["www: refused: the owner's words need where they were said."],
    [
      {
        www: [
          'words',
          'w-plain',
          { placeholder: "<the owner's exact words>" },
          '--where',
          { placeholder: '<where>' },
        ],
      },
    ],
  ]);
});

test('it refuses a --where with a separator, as --who and --where of an approval are', () => {
  const ctx = setupTest();
  const picked = ctx.pick(['words', 'w-plain', 'Plain', '--where', 'chat;1'], false);

  expect(picked.kind === 'refused' && picked.refusal.lines).toStrictEqual([
    'www: refused: --where cannot hold ; or =.',
  ]);
});

test.each([
  { length: 40, kind: 'write' },
  { length: 41, kind: 'refused' },
] as const)('it takes a --where of $length characters as a $kind', (row) => {
  const ctx = setupTest();
  const where = 'w'.repeat(row.length);
  const picked = ctx.pick(['words', 'w-plain', 'Plain', '--where', where], false);

  expect(picked.kind).toBe(row.kind);
});

test('it refuses a 9th piece of the owner words, naming the oldest by time to drop', () => {
  const ctx = setupTest();

  const words = buildMockIDs('word', 8).map((id, at) =>
    ctx.words(id, `2026-03-0${String(9 - at)}T09:00:00Z`),
  );

  const picked = ctx.pick(ctx.argv, false, { words });

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    [
      "www: refused: the session holds 8 of 8 owner's words. Drop one, or replace one with www words.",
    ],
    [{ www: ['drop', 'word08xxxxxxxxxx', '--why', { placeholder: '<reason>' }] }],
  ]);
});
