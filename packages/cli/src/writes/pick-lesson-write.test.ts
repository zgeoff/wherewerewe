import { expect, test } from 'bun:test';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { JournalIndex, LessonRow, Store } from '../types.ts';
import { pickLessonWrite } from './pick-lesson-write.ts';

function setupTest() {
  return {
    argv: [
      'lesson',
      'l-seed',
      'Reseed the staging alerts table before alerts-e2e',
      '--why',
      'A stale row made alerts-e2e pass on day 6 while no alert fired',
    ],
    pick: (
      argv: readonly string[],
      store: Partial<Store> = {},
      journal: Partial<JournalIndex> = {},
    ) =>
      pickLessonWrite({
        store: buildMockStore(store),
        journal: buildMockJournalIndex(journal),
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
    lesson: (id: string, written = '2026-03-04T09:00:00Z'): LessonRow => ({
      id,
      text: 'Old text',
      why: 'Old why',
      written,
      by: 'agent',
    }),
  };
}

test('it writes one row of lessons.tsv and one journal row, and no other file', () => {
  const ctx = setupTest();
  const picked = getPickedWrite(ctx.pick(ctx.argv), 7);

  expect(picked).toStrictEqual({
    change: {
      lessons: [
        {
          id: 'l-seed',
          text: 'Reseed the staging alerts table before alerts-e2e',
          why: 'A stale row made alerts-e2e pass on day 6 while no alert fired',
          written: '2026-03-10T11:43:00Z',
          by: 'agent',
        },
      ],
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'lesson',
          id: 'l-seed',
          by: 'agent',
          text: 'Reseed the staging alerts table before alerts-e2e',
          why: 'A stale row made alerts-e2e pass on day 6 while no alert fired',
          extra: null,
        },
      ],
    },
    reply: 'l-seed  lesson, open, why 62 of 200. Brief: 7 of 8000 tokens.',
  });
});

test('it replaces the lesson of an id in place, with the new text, why and time', () => {
  const ctx = setupTest();
  const other = ctx.lesson('l-other');
  const picked = getPickedWrite(ctx.pick(ctx.argv, { lessons: [ctx.lesson('l-seed'), other] }), 7);

  expect(picked.change.lessons).toStrictEqual([
    expect.objectContaining({
      id: 'l-seed',
      text: 'Reseed the staging alerts table before alerts-e2e',
      written: '2026-03-10T11:43:00Z',
    }),
    other,
  ]);
});

test.each([
  {
    title: 'no --why',
    argv: ['lesson', 'l-seed', 'Reseed the table'],
    lines: ['www: refused: a lesson needs the mistake behind it.'],
    runs: [
      {
        www: [
          'lesson',
          'l-seed',
          'Reseed the table',
          '--why',
          { placeholder: '<the mistake behind it>' },
        ],
      },
    ],
  },
  {
    title: 'a lesson over 120 characters',
    argv: ['lesson', 'l-seed', 'x'.repeat(121), '--why', 'A reason'],
    lines: [
      'www: refused: the lesson is 121 characters, and the limit is 120. Write what is true now; the story belongs in a PR or a commit.',
      'One row holds one fact: split the rest into rows, or put the detail in a file as a list or a table and record the file with www where.',
    ],
    runs: [
      {
        www: [
          'lesson',
          'l-seed',
          { placeholder: '<lesson of at most 120 characters>' },
          '--why',
          'A reason',
        ],
      },
    ],
  },
  {
    title: 'a why over 200 characters',
    argv: ['lesson', 'l-seed', 'Reseed', '--why', 'y'.repeat(201)],
    lines: [
      'www: refused: the why is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.',
      'One row holds one fact: split the rest into rows, or put the detail in a file as a list or a table and record the file with www where.',
    ],
    runs: [
      {
        www: [
          'lesson',
          'l-seed',
          'Reseed',
          '--why',
          { placeholder: '<why of at most 200 characters>' },
        ],
      },
    ],
  },
])('it refuses $title with the typed command and its bad value replaced', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(row.argv);

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    row.lines,
    row.runs,
  ]);
});

test('it refuses a 6th lesson, naming the oldest by time to drop', () => {
  const ctx = setupTest();

  const lessons = buildMockIDs('less', 5).map((id, at) =>
    ctx.lesson(id, `2026-03-0${String(9 - at)}T09:00:00Z`),
  );

  const picked = ctx.pick(ctx.argv, { lessons });

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    ['www: refused: the session holds 5 of 5 lessons. Drop one, or replace one with www lesson.'],
    [{ www: ['drop', 'less05xxxxxxxxxx', '--why', { placeholder: '<reason>' }] }],
  ]);
});

test('it replaces the 5th lesson in place when 5 are held', () => {
  const ctx = setupTest();
  const lessons = ['l-seed', 'l-b', 'l-c', 'l-d', 'l-e'].map((id) => ctx.lesson(id));
  const picked = ctx.pick(ctx.argv, { lessons });

  expect(picked.kind).toBe('write');
});

test('it refuses an id that holds another kind, naming the command that writes it', () => {
  const ctx = setupTest();
  const picked = ctx.pick(ctx.argv, { items: [buildMockItem({ id: 'l-seed' })] });

  expect(picked.kind === 'refused' && picked.refusal.lines).toStrictEqual([
    'www: refused: l-seed is a task. Change its text with set, or pick a new id.',
  ]);
});

test('it refuses an id that the journal closed, with a lesson Run line and a new id', () => {
  const ctx = setupTest();
  const picked = ctx.pick(ctx.argv, {}, { closed: new Map([['l-seed', '2026-03-03T10:00:00Z']]) });

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    ['www: refused: l-seed closed on day 2. Pick a new id.'],
    [
      {
        www: [
          'lesson',
          { placeholder: '<new id>', shape: 'id' },
          'Reseed the staging alerts table before alerts-e2e',
          '--why',
          'A stale row made alerts-e2e pass on day 6 while no alert fired',
        ],
      },
    ],
  ]);
});

test('it refuses a lesson write while lessons.tsv has a row that does not parse', () => {
  const ctx = setupTest();

  const picked = ctx.pick(ctx.argv, {
    lessonsUnread: { file: 'lessons.tsv', line: 3, reason: 'the id repeats an earlier row' },
  });

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    [
      "www: tide-alerts's lessons.tsv line 3 does not parse: the id repeats an earlier row. Fix the row by hand.",
    ],
    [{ shell: ['less', '/state/wherewerewe/tide-alerts/lessons.tsv'] }],
  ]);
});
