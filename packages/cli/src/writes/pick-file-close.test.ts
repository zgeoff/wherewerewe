import { expect, test } from 'bun:test';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import type { JournalIndex, Store } from '../types.ts';
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
  };
}

test.each([
  {
    title: 'an older task closed the id',
    journal: {
      closed: new Map([['l-seed', '2026-03-02T10:00:00Z']]),
      closeRows: new Map([
        [
          'l-seed',
          {
            ts: '2026-03-02T10:00:00Z',
            op: 'done',
            text: 'An old task of the same id',
            kind: null,
          },
        ],
      ]),
    },
  },
  {
    title: 'the earlier close of the id is of another op',
    journal: {
      closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
      closeRows: new Map([
        [
          'l-seed',
          {
            ts: '2026-03-08T10:00:00Z',
            op: 'done',
            text: 'Reseed the staging alerts table before alerts-e2e',
            kind: 'lesson',
          },
        ],
      ]),
    },
  },
  {
    title: 'a task of the same id and text was dropped after the lesson was written',
    journal: {
      closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
      closeRows: new Map([
        [
          'l-seed',
          {
            ts: '2026-03-08T10:00:00Z',
            op: 'drop',
            text: 'Reseed the staging alerts table before alerts-e2e',
            kind: null,
          },
        ],
      ]),
    },
  },
  {
    title: 'a promise of the same id and text was dropped after the lesson was written',
    journal: {
      closed: new Map([['l-seed', '2026-03-08T10:00:00Z']]),
      closeRows: new Map([
        [
          'l-seed',
          {
            ts: '2026-03-08T10:00:00Z',
            op: 'drop',
            text: 'Reseed the staging alerts table before alerts-e2e',
            kind: 'promise',
          },
        ],
      ]),
    },
  },
])('it writes the journal row of a lesson drop when $title', (row) => {
  const ctx = setupTest();

  const lesson = {
    id: 'l-seed',
    text: 'Reseed the staging alerts table before alerts-e2e',
    why: 'A stale row made alerts-e2e pass on day 6',
    written: '2026-03-06T09:00:00Z',
    by: 'agent',
  } as const;

  expect(ctx.pickDrop([lesson], row.journal)).toStrictEqual({
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
    closeRows: new Map([
      ['l-seed', { ts: '2026-03-08T10:00:00Z', op: 'drop', text: lesson.text, kind: 'lesson' }],
    ]),
  });

  expect(picked).toStrictEqual({
    kind: 'write',
    change: { lessons: [], journal: [] },
    reply: expect.any(Function),
  });
});
