import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
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

  const rows = await readJournalRows(ctx.folder, () => true);

  expect(rows.map((row) => `${row.ts} ${row.op} ${row.id}`)).toStrictEqual([
    '2026-03-03T08:00:00Z task t-a',
    '2026-03-04T08:00:00Z done t-a',
  ]);
});

test('it reads no rows when the session has no journal file yet', async () => {
  const ctx = setupTest();

  const rows = await readJournalRows(ctx.folder, () => true);

  expect(rows).toStrictEqual([]);
});

test('it keeps only the rows that the filter accepts', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'task', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-04T08:00:00Z', op: 'task', id: 't-b' });

  const rows = await readJournalRows(ctx.folder, (row) => row.id === 't-b');

  expect(rows.map((row) => row.id)).toStrictEqual(['t-b']);
});

test('it drops a last line that has no newline', async () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    'ts\top\tid\tby\ttext\twhy\textra\n2026-03-03T08:00:00Z\ttask\tt-a\tagent\tx\t-\t-\n2026-03-04T08:00:00Z\ttask\tt-b\tag',
  );

  const rows = await readJournalRows(ctx.folder, () => true);

  expect(rows.map((row) => row.id)).toStrictEqual(['t-a']);
});

test('it throws when the journal cannot be read', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.folder, 'journal.tsv'), { recursive: true });

  expect(readJournalRows(ctx.folder, () => true)).rejects.toThrow();
});
