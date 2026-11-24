import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildSteppedImportFiles } from '../test-utils/build-stepped-import-files.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { createImportFiles } from './create-import-files.ts';
import { writeImportFiles } from './write-import-files.ts';

function setupTest() {
  const folder = join(createTempDir('write-import-files').path, 'old-notes');

  return {
    folder,
    stopBefore: (step: number) =>
      buildSteppedImportFiles(createImportFiles(), step, () => {
        throw new Error('stopped');
      }),
    readText: (name: string): string | null => {
      const path = join(folder, name);

      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
    readMode: (name: string): number => statSync(join(folder, name)).mode & 0o777,
    readNames: () => readdirSync(folder).toSorted(),
    readStaged: (): Record<string, string> =>
      Object.fromEntries(
        readdirSync(folder)
          .filter((name) => name.includes('.tmp-'))
          .map((name) => [
            name.slice(0, name.indexOf('.tmp-')),
            readFileSync(join(folder, name), 'utf8'),
          ]),
      ),
  };
}

test('it copies the originals byte for byte into import-backup/ and writes the new files', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\ngoal=Hold the kiln at 1,280 °C\n');
  seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\nt-a\ttask\tWrite it\n');

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
  );

  writeImportFiles(ctx.folder, {
    originals: {
      session: 'name=old-notes\ngoal=Hold the kiln at 1,280 °C\n',
      items: 'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
      journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
    },
    converted: {
      session: 'format=2\nname=old-notes\n',
      items: 'new items\n',
      journal: 'new journal\n',
    },
  });

  expect({
    backup: ['session', 'items.tsv', 'journal.tsv'].map((name) =>
      ctx.readText(`import-backup/${name}`),
    ),
    files: ['session', 'items.tsv', 'journal.tsv', 'owner.tsv', 'prs.tsv', 'notes.tsv'].map(
      (name) => ctx.readText(name),
    ),
    names: ctx.readNames(),
  }).toStrictEqual({
    backup: [
      'name=old-notes\ngoal=Hold the kiln at 1,280 °C\n',
      'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
      'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
    ],
    files: [
      'format=2\nname=old-notes\n',
      'new items\n',
      'new journal\n',
      'id\ttext\tsaid\ton\n',
      'ref\topened\tstate\tseen\n',
      'id\towed\twritten\tnote\n',
    ],
    names: [
      'import-backup',
      'items.tsv',
      'journal.tsv',
      'notes.tsv',
      'owner.tsv',
      'prs.tsv',
      'session',
    ],
  });
});

test('it gives the backup and each new file the mode of the file it replaces', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');
  seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\n');
  seedStoreFile(ctx.folder, 'journal.tsv', 'ts\top\tid\ttext\n');
  chmodSync(join(ctx.folder, 'session'), 0o600);
  chmodSync(join(ctx.folder, 'items.tsv'), 0o640);
  chmodSync(join(ctx.folder, 'journal.tsv'), 0o600);

  writeImportFiles(ctx.folder, {
    originals: {
      session: 'name=old-notes\n',
      items: 'id\tkind\tclaim\n',
      journal: 'ts\top\tid\ttext\n',
    },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(
    Object.fromEntries(
      [
        'session',
        'items.tsv',
        'journal.tsv',
        'owner.tsv',
        'prs.tsv',
        'notes.tsv',
        'import-backup/session',
        'import-backup/items.tsv',
        'import-backup/journal.tsv',
      ].map((name) => [name, ctx.readMode(name)]),
    ),
  ).toStrictEqual({
    session: 0o600,
    'items.tsv': 0o640,
    'journal.tsv': 0o600,
    'owner.tsv': 0o600,
    'prs.tsv': 0o600,
    'notes.tsv': 0o600,
    'import-backup/session': 0o600,
    'import-backup/items.tsv': 0o640,
    'import-backup/journal.tsv': 0o600,
  });
});

test('it keeps an owner.tsv and a prs.tsv that exist', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');

  seedStoreFile(
    ctx.folder,
    'owner.tsv',
    'id\ttext\tsaid\ton\no-1\tKeep it\t2026-03-03T08:00:00Z\t-\n',
  );

  seedStoreFile(ctx.folder, 'prs.tsv', 'ref\topened\tstate\tseen\n');

  writeImportFiles(ctx.folder, {
    originals: { session: 'name=old-notes\n', items: null, journal: null },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(ctx.readText('owner.tsv')).toBe(
    'id\ttext\tsaid\ton\no-1\tKeep it\t2026-03-03T08:00:00Z\t-\n',
  );
});

test('it keeps a notes.tsv that exists', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');

  seedStoreFile(
    ctx.folder,
    'notes.tsv',
    'id\towed\twritten\tnote\nt-a\t-\t2026-03-03T08:00:00Z\tKeep it\n',
  );

  writeImportFiles(ctx.folder, {
    originals: { session: 'name=old-notes\n', items: null, journal: null },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(ctx.readText('notes.tsv')).toBe(
    'id\towed\twritten\tnote\nt-a\t-\t2026-03-03T08:00:00Z\tKeep it\n',
  );
});

test('it copies only the original files that exist', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');

  writeImportFiles(ctx.folder, {
    originals: { session: 'name=old-notes\n', items: null, journal: null },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(readdirSync(join(ctx.folder, 'import-backup'))).toStrictEqual(['session']);
});

test('it skips the backup when import-backup/ exists, so the true originals stay', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'format=0-by-hand\n');
  seedStoreFile(join(ctx.folder, 'import-backup'), 'session', 'the true original\n');

  writeImportFiles(ctx.folder, {
    originals: { session: 'the true original\n', items: null, journal: null },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(ctx.readText('import-backup/session')).toBe('the true original\n');
});

test('it removes the backup folder and the staged files that an earlier import left', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');
  seedStoreFile(join(ctx.folder, 'import-backup.tmp-1-abcd'), 'session', 'partial\n');
  seedStoreFile(ctx.folder, 'items.tsv.tmp-1-abcd', 'half\n');
  seedStoreFile(ctx.folder, 'session.tmp-1-abcd', 'half\n');
  seedStoreFile(ctx.folder, 'notes.tmp-1-abcd', 'not an import file\n');

  writeImportFiles(ctx.folder, {
    originals: { session: 'name=old-notes\n', items: null, journal: null },
    converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
  });

  expect(ctx.readNames()).toStrictEqual([
    'import-backup',
    'items.tsv',
    'journal.tsv',
    'notes.tmp-1-abcd',
    'notes.tsv',
    'owner.tsv',
    'prs.tsv',
    'session',
  ]);
});

test('it makes 29 file calls on a clean run, which the stop tests below walk through', () => {
  const ctx = setupTest();
  const counted = { calls: 0 };

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');
  seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\n');
  seedStoreFile(ctx.folder, 'journal.tsv', 'ts\top\tid\ttext\n');

  writeImportFiles(
    ctx.folder,
    {
      originals: {
        session: 'name=old-notes\n',
        items: 'id\tkind\tclaim\n',
        journal: 'ts\top\tid\ttext\n',
      },
      converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
    },
    buildSteppedImportFiles(createImportFiles(), 0, () => {
      counted.calls += 1;
    }),
  );

  expect(counted.calls).toBe(29);
});

test.each(Array.from({ length: 27 }, (_value, step) => ({ step })))(
  'it leaves the hand-kept files whole when it stops before call $step',
  (row) => {
    const ctx = setupTest();

    seedStoreFile(ctx.folder, 'session', 'name=old-notes\ngoal=Hold the kiln\n');
    seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\nt-a\ttask\tWrite it\n');

    seedStoreFile(
      ctx.folder,
      'journal.tsv',
      'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
    );

    expect(() => {
      writeImportFiles(
        ctx.folder,
        {
          originals: {
            session: 'name=old-notes\ngoal=Hold the kiln\n',
            items: 'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
            journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
          },
          converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
        },
        ctx.stopBefore(row.step),
      );
    }).toThrow('stopped');

    expect(['session', 'items.tsv', 'journal.tsv'].map((name) => ctx.readText(name))).toStrictEqual(
      [
        'name=old-notes\ngoal=Hold the kiln\n',
        'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
        'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
      ],
    );
  },
);

test.each([
  {
    title: 'items.tsv',
    step: 27,
    files: ['name=old-notes\n', 'new items\n', 'ts\top\tid\ttext\n'],
  },
  {
    title: 'items.tsv and journal.tsv',
    step: 28,
    files: ['name=old-notes\n', 'new items\n', 'new journal\n'],
  },
])('it has renamed $title and not session when it stops before call $step', (row) => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');
  seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\n');
  seedStoreFile(ctx.folder, 'journal.tsv', 'ts\top\tid\ttext\n');

  expect(() => {
    writeImportFiles(
      ctx.folder,
      {
        originals: {
          session: 'name=old-notes\n',
          items: 'id\tkind\tclaim\n',
          journal: 'ts\top\tid\ttext\n',
        },
        converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
      },
      ctx.stopBefore(row.step),
    );
  }).toThrow('stopped');

  expect(['session', 'items.tsv', 'journal.tsv'].map((name) => ctx.readText(name))).toStrictEqual([
    ...row.files,
  ]);
});

test.each(Array.from({ length: 29 }, (_value, step) => ({ step })))(
  'it leaves import-backup/ absent or complete when it stops before call $step',
  (row) => {
    const ctx = setupTest();

    seedStoreFile(ctx.folder, 'session', 'name=old-notes\ngoal=Hold the kiln\n');
    seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\nt-a\ttask\tWrite it\n');

    seedStoreFile(
      ctx.folder,
      'journal.tsv',
      'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
    );

    expect(() => {
      writeImportFiles(
        ctx.folder,
        {
          originals: {
            session: 'name=old-notes\ngoal=Hold the kiln\n',
            items: 'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
            journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
          },
          converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
        },
        ctx.stopBefore(row.step),
      );
    }).toThrow('stopped');

    expect(
      ['session', 'items.tsv', 'journal.tsv'].map((name) => ctx.readText(`import-backup/${name}`)),
    ).toBeOneOf([
      [null, null, null],
      [
        'name=old-notes\ngoal=Hold the kiln\n',
        'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
        'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
      ],
    ]);
  },
);

test.each([
  { step: 17, staged: {} },
  { step: 18, staged: { 'owner.tsv': 'id\ttext\tsaid\ton\n' } },
  {
    step: 19,
    staged: { 'owner.tsv': 'id\ttext\tsaid\ton\n', 'prs.tsv': 'ref\topened\tstate\tseen\n' },
  },
  {
    step: 20,
    staged: {
      'owner.tsv': 'id\ttext\tsaid\ton\n',
      'prs.tsv': 'ref\topened\tstate\tseen\n',
      'notes.tsv': 'id\towed\twritten\tnote\n',
    },
  },
  {
    step: 21,
    staged: {
      'owner.tsv': 'id\ttext\tsaid\ton\n',
      'prs.tsv': 'ref\topened\tstate\tseen\n',
      'notes.tsv': 'id\towed\twritten\tnote\n',
      'items.tsv': 'new items\n',
    },
  },
  {
    step: 22,
    staged: {
      'owner.tsv': 'id\ttext\tsaid\ton\n',
      'prs.tsv': 'ref\topened\tstate\tseen\n',
      'notes.tsv': 'id\towed\twritten\tnote\n',
      'items.tsv': 'new items\n',
      'journal.tsv': 'new journal\n',
    },
  },
  {
    step: 23,
    staged: {
      'owner.tsv': 'id\ttext\tsaid\ton\n',
      'prs.tsv': 'ref\topened\tstate\tseen\n',
      'notes.tsv': 'id\towed\twritten\tnote\n',
      'items.tsv': 'new items\n',
      'journal.tsv': 'new journal\n',
      session: 'format=2\n',
    },
  },
])('it has staged the whole text of $staged when it stops before call $step', (row) => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=old-notes\n');
  seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\n');
  seedStoreFile(ctx.folder, 'journal.tsv', 'ts\top\tid\ttext\n');

  expect(() => {
    writeImportFiles(
      ctx.folder,
      {
        originals: {
          session: 'name=old-notes\n',
          items: 'id\tkind\tclaim\n',
          journal: 'ts\top\tid\ttext\n',
        },
        converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
      },
      ctx.stopBefore(row.step),
    );
  }).toThrow('stopped');

  expect(ctx.readStaged()).toStrictEqual(row.staged);
});

test.each(Array.from({ length: 29 }, (_value, step) => ({ step })))(
  'it finishes the same files, and leaves no temporary file, when it runs again after a stop before call $step',
  (row) => {
    const ctx = setupTest();

    seedStoreFile(ctx.folder, 'session', 'name=old-notes\ngoal=Hold the kiln\n');
    seedStoreFile(ctx.folder, 'items.tsv', 'id\tkind\tclaim\nt-a\ttask\tWrite it\n');

    seedStoreFile(
      ctx.folder,
      'journal.tsv',
      'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
    );

    const write = {
      originals: {
        session: 'name=old-notes\ngoal=Hold the kiln\n',
        items: 'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
        journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
      },
      converted: { session: 'format=2\n', items: 'new items\n', journal: 'new journal\n' },
    };

    expect(() => {
      writeImportFiles(ctx.folder, write, ctx.stopBefore(row.step));
    }).toThrow('stopped');

    writeImportFiles(ctx.folder, write);

    expect({
      files: [
        'session',
        'items.tsv',
        'journal.tsv',
        'owner.tsv',
        'prs.tsv',
        'notes.tsv',
        'import-backup/session',
        'import-backup/items.tsv',
        'import-backup/journal.tsv',
      ].map((name) => ctx.readText(name)),
      names: ctx.readNames(),
    }).toStrictEqual({
      files: [
        'format=2\n',
        'new items\n',
        'new journal\n',
        'id\ttext\tsaid\ton\n',
        'ref\topened\tstate\tseen\n',
        'id\towed\twritten\tnote\n',
        'name=old-notes\ngoal=Hold the kiln\n',
        'id\tkind\tclaim\nt-a\ttask\tWrite it\n',
        'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
      ],
      names: [
        'import-backup',
        'items.tsv',
        'journal.tsv',
        'notes.tsv',
        'owner.tsv',
        'prs.tsv',
        'session',
      ],
    });
  },
);
