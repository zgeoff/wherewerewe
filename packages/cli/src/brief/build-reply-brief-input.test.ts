import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import type { PullRequestRow, Store } from '../types.ts';
import { buildReplyBriefInput } from './build-reply-brief-input.ts';

function setupTest() {
  return {
    buildStore: (fields: Partial<Store>): Store => ({
      folder: '/state/wherewerewe/tide-alerts',
      session: {
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
      },
      items: [],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      ownerUnread: null,
      ...fields,
    }),
    buildRow: (ref: string, state: PullRequestRow['state'] = null): PullRequestRow => ({
      ref,
      opened: '2026-03-10T08:41:30Z',
      state,
      seen: null,
    }),
  };
}

test('it reports no checks in a reply when no item has one, and passes the session and host on', () => {
  const ctx = setupTest();

  const input = buildReplyBriefInput(ctx.buildStore({ items: [buildMockItem({ id: 't-a' })] }), {
    nowMs: 1000,
    sessionFlag: 'tide-alerts',
    host: 'claude',
  });

  expect(input).toStrictEqual({
    session: expect.objectContaining({ name: 'tide-alerts' }),
    items: [expect.objectContaining({ id: 't-a' })],
    notes: [],
    ownerNotes: [],
    changed: [],
    pullRequests: [],
    checks: { kind: 'none' },
    resultsNotSaved: null,
    results: new Map(),
    nowHidden: null,
    nowMs: 1000,
    sessionFlag: 'tide-alerts',
    host: 'claude',
  });
});

test('it passes the owner notes of the store on in a reply', () => {
  const ctx = setupTest();
  const note = { id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null };

  const input = buildReplyBriefInput(ctx.buildStore({ ownerNotes: [note] }), {
    nowMs: 1000,
    sessionFlag: null,
    host: 'codex',
  });

  expect(input.ownerNotes).toStrictEqual([note]);
});

test('it counts the items that have a check as not run yet in a reply', () => {
  const ctx = setupTest();

  const input = buildReplyBriefInput(
    ctx.buildStore({
      items: [
        buildMockItem({ id: 't-a', check: 'pid:42' }),
        buildMockItem({ id: 't-b', check: 'path:/srv/app' }),
        buildMockItem({ id: 't-c' }),
      ],
    }),
    { nowMs: 1000, sessionFlag: null, host: 'codex' },
  );

  expect(input.checks).toStrictEqual({ kind: 'not-run', count: 2 });
});

test('it marks a changed row in a reply from the saved result, and shows each open pull request no item names', () => {
  const ctx = setupTest();

  const input = buildReplyBriefInput(
    ctx.buildStore({
      items: [
        buildMockItem({ id: 't-a', check: 'pid:42', atWrite: 'alive', last: 'gone' }),
        buildMockItem({ id: 't-b', check: 'pr:bosunhq/bosun-api#7', atWrite: 'OPEN pending' }),
      ],
      prs: [
        ctx.buildRow('bosunhq/bosun-api#7', 'OPEN'),
        ctx.buildRow('bosunhq/bosun-app#8', 'OPEN'),
        ctx.buildRow('bosunhq/bosun-app#9'),
        ctx.buildRow('bosunhq/bosun-app#10', 'MERGED'),
      ],
    }),
    { nowMs: 1000, sessionFlag: null, host: 'codex' },
  );

  expect([input.changed.map((change) => change.item.id), input.pullRequests]).toStrictEqual([
    ['t-a'],
    [
      { ref: 'bosunhq/bosun-app#8', opened: '2026-03-10T08:41:30Z', result: 'OPEN' },
      { ref: 'bosunhq/bosun-app#9', opened: '2026-03-10T08:41:30Z', result: '-' },
    ],
  ]);
});
