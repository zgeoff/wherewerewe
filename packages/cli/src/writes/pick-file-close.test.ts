import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { buildCloseModelSteps } from '../test-utils/build-close-model-steps.ts';
import type { CloseModelStep } from '../test-utils/build-close-model-steps.ts';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { runCloseModel } from '../test-utils/run-close-model.ts';
import type { JournalIndex, LastJournalRow, RowFile, Store } from '../types.ts';
import { pickFileClose } from './pick-file-close.ts';

function setupTest() {
  return {
    pickDrop: (lessons: Store['lessons'], journal: Partial<JournalIndex>) =>
      pickFileClose(
        {
          store: buildMockStore({ lessons }),
          journal: buildMockJournalIndex(journal),
          args: buildParsedArgs(['drop', 'l-seed', '--why', 'the table is gone']),
          cwd: '/work',
          nowMs: Date.parse('2026-03-10T11:43:00Z'),
          probed: null,
        },
        'drop',
        'l-seed',
        'the table is gone',
      ),
    buildLastRows: (
      file: RowFile,
      row: LastJournalRow,
    ): Readonly<Record<RowFile, ReadonlyMap<string, LastJournalRow>>> => ({
      items: new Map(),
      lesson: new Map(),
      promise: new Map(),
      words: new Map(),
      [file]: new Map([['l-seed', row]]),
    }),
  };
}

test.each([
  {
    title: 'an older task closed the id',
    file: 'items',
    last: { op: 'done', text: 'An old task of the same id' },
  },
  {
    title: 'the earlier close of the lesson is of another op',
    file: 'lesson',
    last: { op: 'done', text: 'Reseed the staging alerts table before alerts-e2e' },
  },
  {
    title: 'a task of the same id and text was dropped',
    file: 'items',
    last: { op: 'drop', text: 'Reseed the staging alerts table before alerts-e2e' },
  },
  {
    title: 'a promise of the same id and text was dropped',
    file: 'promise',
    last: { op: 'drop', text: 'Reseed the staging alerts table before alerts-e2e' },
  },
  {
    title:
      'a replacement of the same text, in the same second, followed an interrupted drop of the lesson',
    file: 'lesson',
    last: { op: 'lesson', text: 'Reseed the staging alerts table before alerts-e2e' },
  },
] as const)('it writes the journal row of a lesson drop when $title', (row) => {
  const ctx = setupTest();

  const lesson = {
    id: 'l-seed',
    text: 'Reseed the staging alerts table before alerts-e2e',
    why: 'A stale row made alerts-e2e pass on day 6',
    written: '2026-03-10T11:43:00Z',
    by: 'agent',
  } as const;

  expect(
    ctx.pickDrop([lesson], {
      closed: new Map([['l-seed', '2026-03-10T11:43:00Z']]),
      lastRows: ctx.buildLastRows(row.file, row.last),
    }),
  ).toStrictEqual({
    kind: 'write',
    change: {
      lessons: [],
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'drop',
          id: 'l-seed',
          by: 'agent',
          text: lesson.text,
          why: 'the table is gone',
          extra: 'kind=lesson',
        },
      ],
    },
    reply: expect.any(Function),
  });
});

test('it adds no second journal row when its own interrupted close left the lesson in its file', () => {
  const ctx = setupTest();

  const lesson = {
    id: 'l-seed',
    text: 'Reseed the staging alerts table before alerts-e2e',
    why: 'A stale row made alerts-e2e pass on day 6',
    written: '2026-03-06T09:00:00Z',
    by: 'agent',
  } as const;

  const picked = ctx.pickDrop([lesson], {
    closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
    lastRows: ctx.buildLastRows('lesson', { op: 'drop', text: lesson.text }),
  });

  expect(picked).toStrictEqual({
    kind: 'write',
    change: { lessons: [], journal: [] },
    reply: expect.any(Function),
  });
});

test.each([
  { kind: 'lesson', ids: ['l-a', 'l-b'] },
  { kind: 'promise', ids: ['p-a', 'p-b'] },
  { kind: 'words', ids: ['w-a', 'w-b'] },
] as const)(
  'it records every $kind row it removes or replaces, over generated writes, closes and interrupted closes',
  async (row) => {
    setupTest();

    // a close stops after its journal row, and a replacement of the same text in the same second
    // reopens the id: the next close records the replacement's close
    const replacedInTheSameSecond: CloseModelStep[] = [
      { op: 'write', id: row.ids[0], text: 'Pin the clock', tick: 1 },
      { op: 'close', id: row.ids[0], command: 'drop', isInterrupted: true, tick: 1 },
      { op: 'write', id: row.ids[0], text: 'Pin the clock', tick: 0 },
      { op: 'close', id: row.ids[0], command: 'drop', isInterrupted: false, tick: 0 },
    ];

    await fc.assert(
      fc.asyncProperty(buildCloseModelSteps(row.ids), async (steps) => {
        const result = await runCloseModel(row.kind, row.ids, steps);

        expect(result.actual).toStrictEqual(result.expected);
      }),
      { examples: [[replacedInTheSameSecond]] },
    );
  },
);
