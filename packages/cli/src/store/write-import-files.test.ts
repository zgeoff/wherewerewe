import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildSteppedImportFiles } from '../test-utils/build-stepped-import-files.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { createImportFiles } from './create-import-files.ts';
import { writeImportFiles } from './write-import-files.ts';

function setupTest() {
  const folder = join(createTempDir('write-import-files').path, 'old-notes');

  const originals = {
    session: 'name=old-notes\ngoal=Hold the kiln at 1,280 °C\nstarted=2026-03-02T08:00:00Z\n',
    items: 'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
    journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
  };

  const converted = {
    session: 'format=1\nname=old-notes\n',
    items: 'new items\n',
    journal: 'new journal\n',
  };

  seedStoreFile(folder, 'session', originals.session);
  seedStoreFile(folder, 'items.tsv', originals.items);
  seedStoreFile(folder, 'journal.tsv', originals.journal);

  return {
    folder,
    originals,
    converted,
    ownerHeader: 'id\ttext\tsaid\ton\n',
    prsHeader: 'ref\topened\tstate\tseen\n',
    write: (files = createImportFiles()) => {
      writeImportFiles(folder, { originals, converted }, files);
    },
    stopBefore: (step: number) =>
      buildSteppedImportFiles(createImportFiles(), step, () => {
        throw new Error('stopped');
      }),
    readText: (name: string): string | null => {
      const path = join(folder, name);

      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
    readNames: () => readdirSync(folder).toSorted(),
  };
}

test('it copies the originals byte for byte into import-backup/ and writes the new files', () => {
  const ctx = setupTest();

  ctx.write();

  expect({
    backup: ['session', 'items.tsv', 'journal.tsv'].map((name) =>
      ctx.readText(`import-backup/${name}`),
    ),
    files: ['session', 'items.tsv', 'journal.tsv', 'owner.tsv', 'prs.tsv'].map((name) =>
      ctx.readText(name),
    ),
    names: ctx.readNames(),
  }).toStrictEqual({
    backup: [ctx.originals.session, ctx.originals.items, ctx.originals.journal],
    files: [
      ctx.converted.session,
      ctx.converted.items,
      ctx.converted.journal,
      ctx.ownerHeader,
      ctx.prsHeader,
    ],
    names: ['import-backup', 'items.tsv', 'journal.tsv', 'owner.tsv', 'prs.tsv', 'session'],
  });
});

test('it makes 19 file calls on a clean run, which the stop tests below walk through', () => {
  const ctx = setupTest();
  const counted = { calls: 0 };

  ctx.write(
    buildSteppedImportFiles(createImportFiles(), 0, () => {
      counted.calls += 1;
    }),
  );

  expect(counted.calls).toBe(19);
});

test('it keeps an owner.tsv and a prs.tsv that exist', () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'owner.tsv',
    'id\ttext\tsaid\ton\no-1\tKeep it\t2026-03-03T08:00:00Z\t-\n',
  );

  seedStoreFile(ctx.folder, 'prs.tsv', 'ref\topened\tstate\tseen\n');

  ctx.write();

  expect(ctx.readText('owner.tsv')).toBe(
    'id\ttext\tsaid\ton\no-1\tKeep it\t2026-03-03T08:00:00Z\t-\n',
  );
});

test('it copies only the original files that exist', () => {
  const ctx = setupTest();
  const folder = join(createTempDir('write-import-files').path, 'old-notes');

  seedStoreFile(folder, 'session', ctx.originals.session);

  writeImportFiles(folder, {
    originals: { session: ctx.originals.session, items: null, journal: null },
    converted: ctx.converted,
  });

  expect(readdirSync(join(folder, 'import-backup'))).toStrictEqual(['session']);
});

test('it skips the backup when import-backup/ exists, so the true originals stay', () => {
  const ctx = setupTest();

  seedStoreFile(join(ctx.folder, 'import-backup'), 'session', 'the true original\n');

  ctx.write();

  expect(ctx.readText('import-backup/session')).toBe('the true original\n');
});

test('it removes an import-backup.tmp-* folder that an earlier import left', () => {
  const ctx = setupTest();

  seedStoreFile(join(ctx.folder, 'import-backup.tmp-1-abcd'), 'session', 'partial\n');

  ctx.write();

  expect(ctx.readNames()).toStrictEqual([
    'import-backup',
    'items.tsv',
    'journal.tsv',
    'owner.tsv',
    'prs.tsv',
    'session',
  ]);
});

// Calls 0 to 6 make the backup, 7 and 8 look for owner.tsv and prs.tsv, 9 to 13 write the
// temporary files, and 14 to 18 rename them, with items.tsv at 16 and session last.
test.each(Array.from({ length: 19 }, (_value, step) => ({ step })))(
  'it leaves the hand-kept files whole when it stops before call $step, until items.tsv is renamed',
  (row) => {
    const ctx = setupTest();

    expect(() => {
      ctx.write(ctx.stopBefore(row.step));
    }).toThrow('stopped');

    expect({
      backupJournal: ctx.readText('import-backup/journal.tsv'),
      backupItems: ctx.readText('import-backup/items.tsv'),
      backupSession: ctx.readText('import-backup/session'),
      items: ctx.readText('items.tsv'),
      session: ctx.readText('session'),
    }).toStrictEqual({
      backupJournal: row.step >= 7 ? ctx.originals.journal : null,
      backupItems: row.step >= 7 ? ctx.originals.items : null,
      backupSession: row.step >= 7 ? ctx.originals.session : null,
      items: row.step <= 16 ? ctx.originals.items : ctx.converted.items,
      session: ctx.originals.session,
    });
  },
);

test.each(Array.from({ length: 19 }, (_value, step) => ({ step })))(
  'it finishes the same files when it runs again after a stop before call $step',
  (row) => {
    const ctx = setupTest();

    expect(() => {
      ctx.write(ctx.stopBefore(row.step));
    }).toThrow('stopped');

    ctx.write();

    expect({
      files: [
        'session',
        'items.tsv',
        'journal.tsv',
        'owner.tsv',
        'prs.tsv',
        'import-backup/session',
      ].map((name) => ctx.readText(name)),
      stray: ctx.readNames().filter((name) => name.startsWith('import-backup.tmp-')),
    }).toStrictEqual({
      files: [
        ctx.converted.session,
        ctx.converted.items,
        ctx.converted.journal,
        ctx.ownerHeader,
        ctx.prsHeader,
        ctx.originals.session,
      ],
      stray: [],
    });
  },
);
