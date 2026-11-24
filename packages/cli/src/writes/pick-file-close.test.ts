import { expect, test } from 'bun:test';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { JournalIndex } from '../types.ts';
import { pickFileClose } from './pick-file-close.ts';

function setupTest() {
  const lesson = {
    id: 'l-seed',
    text: 'Reseed the staging alerts table before alerts-e2e',
    why: 'A stale row made alerts-e2e pass on day 6',
    written: '2026-03-06T09:00:00Z',
    by: 'agent',
  } as const;

  return {
    lesson,
    pickDrop: (journal: Partial<JournalIndex>) => {
      const picked = pickFileClose(
        {
          store: buildMockStore({ lessons: [lesson] }),
          journal: buildMockJournalIndex(journal),
          args: buildParsedArgs(['drop', 'l-seed', '--why', 'the table is gone']),
          cwd: '/work',
          nowMs: Date.parse('2026-03-10T11:43:00Z'),
          probed: null,
        },
        'drop',
        'l-seed',
        'the table is gone',
      );

      return picked === null ? null : getPickedWrite(picked, 7);
    },
  };
}

test('it writes the journal row of a lesson whose id an older task closed', () => {
  const ctx = setupTest();

  const picked = ctx.pickDrop({
    closed: new Map([['l-seed', '2026-03-02T10:00:00Z']]),
    closeRows: new Map([
      ['l-seed', { ts: '2026-03-02T10:00:00Z', op: 'done', text: 'An old task of the same id' }],
    ]),
  });

  expect(picked?.change.journal).toStrictEqual([
    {
      ts: '2026-03-10T11:43:00Z',
      op: 'drop',
      id: 'l-seed',
      by: 'agent',
      text: ctx.lesson.text,
      why: 'the table is gone',
      extra: null,
    },
  ]);
});

test('it writes the journal row when the earlier close of the id is of another op', () => {
  const ctx = setupTest();

  const picked = ctx.pickDrop({
    closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
    closeRows: new Map([
      ['l-seed', { ts: '2026-03-08T10:00:00Z', op: 'done', text: ctx.lesson.text }],
    ]),
  });

  expect(picked?.change.journal).toHaveLength(1);
});

test('it adds no second journal row when its own interrupted close left the lesson in its file', () => {
  const ctx = setupTest();

  const picked = ctx.pickDrop({
    closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
    closeRows: new Map([
      ['l-seed', { ts: '2026-03-08T10:00:00Z', op: 'drop', text: ctx.lesson.text }],
    ]),
  });

  expect(picked?.change).toStrictEqual({ lessons: [], journal: [] });
});
