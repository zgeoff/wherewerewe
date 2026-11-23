import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { readStore } from './read-store.ts';
import { writeStoreFiles } from './write-store-files.ts';

function setupTest() {
  const root = createTempDir('write-store').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it writes the items and the session, and appends the journal rows', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  await writeStoreFiles(ctx.folder, {
    items: [
      {
        id: 't-a',
        kind: 'task',
        claim: 'Write it',
        check: null,
        atWrite: null,
        last: null,
        written: '2026-03-10T10:31:09Z',
        by: 'agent',
        extra: {},
      },
    ],
    session: {
      format: '1',
      name: 'tide-alerts',
      goal: 'Ship it',
      started: '2026-03-02T08:04:11Z',
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: '2026-03-10T10:31:09Z',
      lastNudge: null,
      importedFrom: null,
    },
    journal: [
      {
        ts: '2026-03-10T10:31:09Z',
        op: 'task',
        id: 't-a',
        by: 'agent',
        text: 'Write it',
        why: null,
        extra: null,
      },
    ],
  });

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ lastWrite: '2026-03-10T10:31:09Z' }),
      items: [expect.objectContaining({ id: 't-a' })],
    },
  });

  expect(readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8')).toEndWith(
    '2026-03-10T10:31:09Z\ttask\tt-a\tagent\tWrite it\t-\t-\n',
  );
});

test('it leaves no temporary file behind, and never opens owner.tsv or prs.tsv', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  const ownerBefore = statSync(join(ctx.folder, 'owner.tsv')).mtimeMs;
  const prsBefore = statSync(join(ctx.folder, 'prs.tsv')).mtimeMs;

  await writeStoreFiles(ctx.folder, { items: [], journal: [] });

  expect(readdirSync(ctx.folder).toSorted()).toStrictEqual([
    'items.tsv',
    'journal.tsv',
    'owner.tsv',
    'prs.tsv',
    'session',
  ]);

  expect([
    statSync(join(ctx.folder, 'owner.tsv')).mtimeMs,
    statSync(join(ctx.folder, 'prs.tsv')).mtimeMs,
  ]).toStrictEqual([ownerBefore, prsBefore]);
});

test('it leaves the items alone when the journal append fails, so a close is never lost', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  rmSync(join(ctx.folder, 'journal.tsv'));
  mkdirSync(join(ctx.folder, 'journal.tsv'));

  const written = writeStoreFiles(ctx.folder, {
    items: [],
    journal: [
      {
        ts: '2026-03-10T10:31:09Z',
        op: 'done',
        id: 't-a',
        by: 'agent',
        text: 'Write it',
        why: 'commit 4c1d2e0',
        extra: null,
      },
    ],
  });

  await expect(written).toReject();

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [expect.objectContaining({ id: 't-a' })],
    },
  });
});
