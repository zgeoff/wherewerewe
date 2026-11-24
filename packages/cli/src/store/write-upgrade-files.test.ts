import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { findFormat } from '../import/find-format.ts';
import { pickUpgrade } from '../import/pick-upgrade.ts';
import { runCLI } from '../run-cli.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildSteppedImportFiles } from '../test-utils/build-stepped-import-files.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
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
          args: buildParsedArgs([
            'import',
            name,
            '--quote',
            'Merge and deploy to the staging beds yourself.',
            '--where',
            'chat',
            '--reading',
            'covers garden-api merges and staging deploys',
          ]),
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
    run: (argv: readonly string[]) =>
      runCLI({
        argv,
        env: { HOME: root, XDG_STATE_HOME: root },
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => nowMs,
      }),
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
  'it leaves format 1 with a whole backup, or format 2 whole, when it stops at file call $step',
  async (row) => {
    const ctx = setupTest();
    const clean = setupTest();

    ctx.copyStore();
    clean.copyStore();

    const originals = ctx.readOriginals();
    const write = ctx.readUpgradeWrite();

    writeUpgradeFiles(clean.folder, clean.readUpgradeWrite());

    expect(() => {
      writeUpgradeFiles(ctx.folder, write, ctx.stopBefore(row.step));
    }).toThrow('stopped');

    const hasBackup = existsSync(join(ctx.folder, 'format-1-backup'));
    const session = readFileSync(join(ctx.folder, 'session'), 'utf8');
    const format = findFormat(session);

    const before = await ctx.readTree();
    const brief = await ctx.run(['--session', ctx.name]);
    const write2 = await ctx.run(['task', 't-x', 'x', '--session', ctx.name]);
    const store = await readStore(ctx.folder);
    const after = await ctx.readTree();

    // a format 1 store refuses every command, and a format 2 store reads whole
    expect({
      format,
      refusals:
        format === '1'
          ? [brief.exitCode, write2.exitCode, brief.stderr.includes('is format 1')]
          : null,
      store: format === '2' ? store.kind : null,
      isSessionWhole: format === '2' ? session : null,
      backup: hasBackup
        ? ctx.originalNames.map((file) =>
            readFileSync(join(ctx.folder, 'format-1-backup', file), 'utf8'),
          )
        : originals,
      changedByReads: format === '1' ? after : before,
    }).toStrictEqual({
      format: format === '1' ? '1' : '2',
      refusals: format === '1' ? [5, 5, true] : null,
      store: format === '2' ? 'store' : null,
      isSessionWhole: format === '2' ? readFileSync(join(clean.folder, 'session'), 'utf8') : null,
      backup: originals,
      changedByReads: before,
    });

    writeUpgradeFiles(ctx.folder, write);

    const upgraded = await readTreeHashes(ctx.folder);
    const expected = await readTreeHashes(clean.folder);

    expect(upgraded).toStrictEqual(expected);
  },
);
