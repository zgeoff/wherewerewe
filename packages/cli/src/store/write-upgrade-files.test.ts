import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { findFormat } from '../import/find-format.ts';
import { pickUpgrade } from '../import/pick-upgrade.ts';
import { runCLI } from '../run-cli.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildSteppedImportFiles } from '../test-utils/build-stepped-import-files.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import type { CLIResult } from '../types.ts';
import { createImportFiles } from './create-import-files.ts';
import { formatItemsFile } from './format-items-file.ts';
import { formatJournalRows } from './format-journal-rows.ts';
import { formatNotesFile } from './format-notes-file.ts';
import { formatSessionFile } from './format-session-file.ts';
import { readStore } from './read-store.ts';
import type { ImportFiles } from './types.ts';
import { writeUpgradeFiles } from './write-upgrade-files.ts';

function setupTest() {
  const name = 'garden-beds';
  const nowMs = Date.parse('2026-03-10T11:43:00Z');
  const originalNames = ['session', 'items.tsv', 'notes.tsv', 'journal.tsv'];
  const root = createTempDir('write-upgrade-files').path;
  const stateRoot = join(root, 'wherewerewe');
  const folder = join(stateRoot, name);

  const run = (argv: readonly string[]) =>
    runCLI({
      argv,
      env: { HOME: root, XDG_STATE_HOME: root },
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => nowMs,
    });

  const upgradeArgv = [
    'import',
    name,
    '--may',
    'Merge the garden-api pull requests yourself.',
    '--may',
    'Deploy to the staging beds.',
    '--not',
    'Wipe the staging sensor table.',
    '--never',
    'Touch the prod beds.',
    '--scope',
    'garden-api and staging',
    '--where',
    'chat',
    '--reading',
    'covers garden-api merges and staging deploys',
  ];

  return {
    name,
    originalNames,
    root,
    stateRoot,
    folder,
    copyStore: () => seedFormat1Store(stateRoot, name),
    readOriginals: () => originalNames.map((file) => readFileSync(join(folder, file), 'utf8')),

    // What the command writes for the seeded store, with the grant words an owner would give.
    readUpgradeWrite: () => {
      const read = (file: string) => readFileSync(join(folder, file), 'utf8');

      const picked = pickUpgrade(
        {
          session: read('session'),
          items: read('items.tsv'),
          notes: read('notes.tsv'),
          journal: read('journal.tsv'),
        },
        {
          name,
          folder,
          args: buildParsedArgs(upgradeArgv),
          nowMs,
          byOwner: false,
          agent: null,
        },
      );

      if (picked.kind === 'refused') {
        throw new Error('the seeded store is refused');
      }

      return {
        session: formatSessionFile(picked.session),
        items: formatItemsFile(picked.items),
        notes: formatNotesFile(picked.notes),
        journal: `${read('journal.tsv')}${formatJournalRows(picked.journalRows)}`,
      };
    },
    countCalls: (files: ImportFiles): { files: ImportFiles; count: () => number } => {
      const state = { count: 0 };

      return {
        files: buildSteppedImportFiles(files, 0, () => {
          state.count += 1;
        }),
        count: () => state.count,
      };
    },
    stopBefore: (step: number) =>
      buildSteppedImportFiles(createImportFiles(), step, () => {
        throw new Error('stopped');
      }),

    // The process ends right after the rename that makes the store format 2.
    stopAfterCommit: (): ImportFiles => {
      const files = createImportFiles();

      return {
        ...files,
        rename: (from, to) => {
          files.rename(from, to);

          if (basename(to) === 'session') {
            throw new Error('stopped');
          }
        },
      };
    },
    runUpgrade: () => run(upgradeArgv),
    readBackup: (): string[] | null =>
      existsSync(join(folder, 'format-1-backup'))
        ? originalNames.map((file) => readFileSync(join(folder, 'format-1-backup', file), 'utf8'))
        : null,
    run,
    readTree: () => readTreeHashes(stateRoot),
  };
}

test('it copies the format 1 files into format-1-backup/ and writes the four new files', () => {
  const ctx = setupTest();

  ctx.copyStore();

  const originals = ctx.readOriginals();
  const write = ctx.readUpgradeWrite();

  writeUpgradeFiles(ctx.folder, write);

  expect({
    backup: ctx.originalNames.map((file) =>
      readFileSync(join(ctx.folder, 'format-1-backup', file), 'utf8'),
    ),
    files: ctx.originalNames.map((file) => readFileSync(join(ctx.folder, file), 'utf8')),
    names: readdirSync(ctx.folder).toSorted(),
  }).toStrictEqual({
    backup: originals,
    files: [write.session, write.items, write.notes, write.journal],
    names: [
      'format-1-backup',
      'items.tsv',
      'journal.tsv',
      'notes.tsv',
      'owner.tsv',
      'prs.tsv',
      'session',
    ],
  });
});

test('it keeps the first backup when format-1-backup/ exists, so the true originals stay', () => {
  const ctx = setupTest();

  ctx.copyStore();

  const originals = ctx.readOriginals();
  const write = ctx.readUpgradeWrite();

  writeUpgradeFiles(ctx.folder, write);
  writeUpgradeFiles(ctx.folder, write);

  expect(
    ctx.originalNames.map((file) =>
      readFileSync(join(ctx.folder, 'format-1-backup', file), 'utf8'),
    ),
  ).toStrictEqual(originals);
});

test('it removes the backup folder and the staged files that an earlier upgrade left', () => {
  const ctx = setupTest();

  ctx.copyStore();

  const files = createImportFiles();

  files.makeFolder(join(ctx.folder, 'format-1-backup.tmp-1-ab'));
  files.writeFile(join(ctx.folder, 'items.tsv.tmp-1-ab'), 'half\n', 0o600);

  writeUpgradeFiles(ctx.folder, ctx.readUpgradeWrite());

  expect(readdirSync(ctx.folder).filter((file) => file.includes('.tmp-'))).toStrictEqual([]);
});

test('it makes 28 file calls on a clean run, which the stop tests below walk through', () => {
  const ctx = setupTest();

  ctx.copyStore();

  const counted = ctx.countCalls(createImportFiles());

  writeUpgradeFiles(ctx.folder, ctx.readUpgradeWrite(), counted.files);

  expect(counted.count()).toBe(28);
});

test.each(Array.from({ length: 28 }, (_value, step) => ({ step })))(
  'it leaves format 1 with a whole backup or none, and refuses every command, when it stops before file call $step',
  async (row) => {
    const ctx = setupTest();
    const clean = setupTest();

    ctx.copyStore();
    clean.copyStore();

    const originals = ctx.readOriginals();
    const write = ctx.readUpgradeWrite();

    await clean.runUpgrade();

    expect(() => {
      writeUpgradeFiles(ctx.folder, write, ctx.stopBefore(row.step));
    }).toThrow('stopped');

    const stopped = await ctx.readTree();
    const read = await readStore(ctx.folder);
    const brief = await ctx.run(['--session', ctx.name]);
    const task = await ctx.run(['task', 't-x', 'x', '--session', ctx.name]);

    const refusal: CLIResult = {
      exitCode: 5,
      stdout: '',
      stderr: `www: ${ctx.name} is format 1, and this www reads format 2. Upgrade it in place; the upgrade keeps a copy of each file it changes, and changes nothing when it refuses.\nRun: www --session ${ctx.name} import ${ctx.name}\n`,
    };

    const session = readFileSync(join(ctx.folder, 'session'), 'utf8');

    expect({
      format: findFormat(session),
      store: read.kind,
      refusals: [brief, task],
      changedByRefusals: await ctx.readTree(),
    }).toStrictEqual({
      format: '1',
      store: 'format-1',
      refusals: [refusal, refusal],
      changedByRefusals: stopped,
    });

    expect(ctx.readBackup()).toBeOneOf([null, originals]);

    const rerun = await ctx.runUpgrade();

    expect({ rerun: rerun.exitCode, tree: await readTreeHashes(ctx.folder) }).toStrictEqual({
      rerun: 0,
      tree: await readTreeHashes(clean.folder),
    });
  },
);

test('it leaves format 2 whole when it stops after the file call that renames session', async () => {
  const ctx = setupTest();
  const clean = setupTest();

  ctx.copyStore();
  clean.copyStore();

  const originals = ctx.readOriginals();
  const write = ctx.readUpgradeWrite();

  await clean.runUpgrade();

  expect(() => {
    writeUpgradeFiles(ctx.folder, write, ctx.stopAfterCommit());
  }).toThrow('stopped');

  const read = await readStore(ctx.folder);
  const brief = await ctx.run(['--session', ctx.name]);
  const rerun = await ctx.runUpgrade();

  const session = readFileSync(join(ctx.folder, 'session'), 'utf8');

  expect({
    format: findFormat(session),
    store: read.kind,
    briefExitCode: brief.exitCode,
    backup: ctx.readBackup(),
    rerun: { exitCode: rerun.exitCode, stderr: rerun.stderr },
    tree: await readTreeHashes(ctx.folder),
  }).toStrictEqual({
    format: '2',
    store: 'store',
    briefExitCode: 0,
    backup: originals,
    rerun: {
      exitCode: 3,
      stderr: `www: refused: ${ctx.name} is already format 2.\nRun: www --session ${ctx.name}\n`,
    },
    tree: await readTreeHashes(clean.folder),
  });
});
