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

test('it appends a row with the extra it is given', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'decide',
    id: 'd-1',
    extra: 'who=owner',
  });

  expect(readFileSync(join(folder, 'journal.tsv'), 'utf8')).toEndWith(
    '2026-03-04T08:00:00Z\tdecide\td-1\tagent\ta claim\ta reason\twho=owner\n',
  );
});

test('it appends a row by the author it is given', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'say',
    id: 'o-1',
    by: 'import',
  });

  expect(readFileSync(join(folder, 'journal.tsv'), 'utf8')).toEndWith(
    '2026-03-04T08:00:00Z\tsay\to-1\timport\ta claim\ta reason\t-\n',
  );
});

test('it appends a row with the text and why it is given', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'note',
    id: 't-a',
    text: 'Stop the simulator first',
    why: null,
    extra: 'owed=1',
  });

  expect(readFileSync(join(folder, 'journal.tsv'), 'utf8')).toEndWith(
    '2026-03-04T08:00:00Z\tnote\tt-a\tagent\tStop the simulator first\t-\towed=1\n',
  );
});
