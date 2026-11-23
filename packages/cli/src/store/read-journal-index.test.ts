import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { readJournalIndex } from './read-journal-index.ts';

function setupTest() {
  const root = createTempDir('journal-index').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it finds each id that a done, drop or use row closed, with the ts of that row', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'task', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-04T08:00:00Z', op: 'done', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-05T08:00:00Z', op: 'drop', id: 'w-b' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-06T08:00:00Z', op: 'use', id: 'ok-c' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-07T08:00:00Z', op: 'set', id: 't-d' });

  const index = await readJournalIndex(ctx.folder);

  expect(index.closed).toStrictEqual(
    new Map([
      ['t-a', '2026-03-04T08:00:00Z'],
      ['w-b', '2026-03-05T08:00:00Z'],
      ['ok-c', '2026-03-06T08:00:00Z'],
    ]),
  );
});

test('it finds nothing when the session has no journal file yet', async () => {
  const ctx = setupTest();

  const index = await readJournalIndex(ctx.folder);

  expect(index.closed).toStrictEqual(new Map());
});
