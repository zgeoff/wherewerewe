import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import type { PullRequestRow } from '../types.ts';
import { pickSavedStore } from './pick-saved-store.ts';
import type { CheckRun } from './types.ts';

function setupTest() {
  return {
    pickSaved: (fields: Parameters<typeof buildMockStore>[0], results: Record<string, string>) =>
      pickSavedStore(
        buildMockStore(fields),
        {
          results: new Map(Object.entries(results)),
          ran: Object.keys(results).length,
          unchecked: 0,
          reason: null,
          elapsedMs: 100,
        } satisfies CheckRun,
        '2026-03-10T11:43:00Z',
      ),
  };
}

test('it gives an item the result of its probe as its last result', () => {
  const ctx = setupTest();

  const saved = ctx.pickSaved(
    { items: [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'alive' })] },
    { 't-a': 'gone' },
  );

  expect(saved.items).toStrictEqual([
    expect.objectContaining({ id: 't-a', atWrite: 'alive', last: 'gone' }),
  ]);
});

test('it keeps the store as it is when no probe has a result', () => {
  const ctx = setupTest();
  const items = [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'alive' })];
  const saved = ctx.pickSaved({ items }, {});

  expect(saved.items).toStrictEqual(items);
});

test('it gives an open pull request row the state its probe read', () => {
  const ctx = setupTest();

  const row: PullRequestRow = {
    ref: 'bosunhq/bosun-api#77',
    opened: '2026-03-10T08:43:00Z',
    state: 'OPEN',
    seen: '2026-03-10T09:00:00Z',
  };

  const saved = ctx.pickSaved({ prs: [row] }, { 'bosunhq/bosun-api#77': 'MERGED' });

  expect(saved.prs).toStrictEqual([{ ...row, state: 'MERGED', seen: '2026-03-10T11:43:00Z' }]);
});

test('it leaves the pull request rows as they are when prs.tsv did not parse', () => {
  const ctx = setupTest();

  const row: PullRequestRow = {
    ref: 'bosunhq/bosun-api#77',
    opened: '2026-03-10T08:43:00Z',
    state: 'OPEN',
    seen: null,
  };

  const saved = ctx.pickSaved(
    { prs: [row], prsUnread: { file: 'prs.tsv', line: 2, reason: 'bad row' } },
    { 'bosunhq/bosun-api#77': 'MERGED' },
  );

  expect(saved.prs).toStrictEqual([row]);
});
