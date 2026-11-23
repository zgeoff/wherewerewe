import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildBriefInput } from './build-brief-input.ts';

test('it reports no checks when no item has one, with empty later sections', () => {
  const session = buildBriefInput(
    {
      folder: '/state/wherewerewe/tide-alerts',
      session: {
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
      },
      items: [buildMockItem({ id: 't-a' })],
      ownerNotes: [],
      ownerUnread: null,
    },
    1000,
  );

  expect(session).toStrictEqual({
    session: expect.objectContaining({ name: 'tide-alerts' }),
    items: [expect.objectContaining({ id: 't-a' })],
    ownerNotes: [],
    changed: [],
    pullRequests: [],
    checks: { kind: 'none' },
    resultsNotSaved: null,
    nowMs: 1000,
  });
});

test('it passes the owner notes of the store on', () => {
  const note = { id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null };

  const input = buildBriefInput(
    {
      folder: '/state/wherewerewe/tide-alerts',
      session: {
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
      },
      items: [],
      ownerNotes: [note],
      ownerUnread: null,
    },
    1000,
  );

  expect(input.ownerNotes).toStrictEqual([note]);
});

test('it counts the items that have a check as not run yet', () => {
  const input = buildBriefInput(
    {
      folder: '/state/wherewerewe/tide-alerts',
      session: {
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
      },
      items: [
        buildMockItem({ id: 't-a', check: 'pid:42' }),
        buildMockItem({ id: 't-b', check: 'path:/srv/app' }),
        buildMockItem({ id: 't-c' }),
      ],
      ownerNotes: [],
      ownerUnread: null,
    },
    1000,
  );

  expect(input.checks).toStrictEqual({ kind: 'not-run', count: 2 });
});
