import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { readJournalRows } from './read-journal-rows.ts';

function setupTest() {
  const root = createTempDir('journal-rows').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it reads each journal row, oldest first, and skips the header', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'task', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-04T08:00:00Z', op: 'done', id: 't-a' });

  const rows = await readJournalRows(ctx.folder);

  expect(rows.map((row) => `${row.ts} ${row.op} ${row.id}`)).toStrictEqual([
    '2026-03-03T08:00:00Z task t-a',
    '2026-03-04T08:00:00Z done t-a',
  ]);
});

test('it reads no rows when the session has no journal file yet', async () => {
  const ctx = setupTest();

  const rows = await readJournalRows(ctx.folder);

  expect(rows).toStrictEqual([]);
});
