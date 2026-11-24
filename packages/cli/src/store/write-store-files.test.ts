import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { parseJournalFile } from './parse-journal-file.ts';
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
      format: '2',
      grant: null,
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
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      ownerUnread: null,
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
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      ownerUnread: null,
    },
  });
});

// A folder that is not writable still lets the append to journal.tsv land, and stops the rewrite,
// which needs a temporary file in the folder.
test('it appends the journal row before it rewrites the items, so a close that stops between them is recorded with its item still open', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  chmodSync(ctx.folder, 0o555);

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

  chmodSync(ctx.folder, 0o755);

  const journal = readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8');

  expect({
    read: await readStore(ctx.folder),
    last: parseJournalFile(journal).at(-1),
  }).toStrictEqual({
    read: {
      kind: 'store',
      store: {
        folder: ctx.folder,
        session: expect.objectContaining({ name: 'tide-alerts' }),
        items: [expect.objectContaining({ id: 't-a' })],
        ownerNotes: [],
        notes: [],
        notesUnread: null,
        prs: [],
        prsUnread: null,
        ownerUnread: null,
      },
    },
    last: expect.objectContaining({ op: 'done', id: 't-a' }),
  });
});

test('it writes notes.tsv when the change has notes, and leaves it as it is when the change has none', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a' });

  await writeStoreFiles(ctx.folder, {
    journal: [],
    notes: [{ id: 't-a', owed: true, written: '2026-03-10T11:00:00Z', note: 'Stop it' }],
  });

  const written = readFileSync(join(ctx.folder, 'notes.tsv'), 'utf8');

  await writeStoreFiles(ctx.folder, { items: [], journal: [] });

  expect({ written, after: readFileSync(join(ctx.folder, 'notes.tsv'), 'utf8') }).toStrictEqual({
    written: 'id\towed\twritten\tnote\nt-a\towed\t2026-03-10T11:00:00Z\tStop it\n',
    after: 'id\towed\twritten\tnote\nt-a\towed\t2026-03-10T11:00:00Z\tStop it\n',
  });
});

test('it appends the journal before it writes notes.tsv, so a failed notes write keeps the note row', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a' });

  mkdirSync(join(ctx.folder, 'notes.tsv'));

  const writing = writeStoreFiles(ctx.folder, {
    journal: [
      {
        ts: '2026-03-10T11:00:00Z',
        op: 'note',
        id: 't-a',
        by: 'agent',
        text: 'Stop it',
        why: null,
        extra: null,
      },
    ],
    notes: [{ id: 't-a', owed: false, written: '2026-03-10T11:00:00Z', note: 'Stop it' }],
  });

  const outcome = await writing.then(
    () => 'written',
    () => 'failed',
  );

  expect(outcome).toBe('failed');

  const journalText = readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8');

  expect(parseJournalFile(journalText)).toStrictEqual([
    expect.objectContaining({ op: 'note', id: 't-a' }),
  ]);
});
