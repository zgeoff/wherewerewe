import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedJournalRow } from './seed-journal-row.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  return { root: createTempDir('seed-journal').path };
}

test('it appends one row to the journal', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(folder, { ts: '2026-03-04T08:00:00Z', op: 'done', id: 't-a' });

  expect(readFileSync(join(folder, 'journal.tsv'), 'utf8')).toEndWith(
    '2026-03-04T08:00:00Z\tdone\tt-a\tagent\ta claim\ta reason\t-\n',
  );
});
