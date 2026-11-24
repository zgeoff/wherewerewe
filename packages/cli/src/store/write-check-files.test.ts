import { expect, test } from 'bun:test';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { readStore } from './read-store.ts';
import { writeCheckFiles } from './write-check-files.ts';

function setupTest() {
  const root = createTempDir('write-check-files').path;

  return {
    root,
    folder: join(root, 'tide-alerts'),
    changedRow: {
      ts: '2026-03-10T11:43:00Z',
      op: 'changed',
      id: 't-a',
      by: 'agent',
      text: 'alive -> gone',
      why: null,
      extra: null,
    } as const,
  };
}

test('it appends the journal, then rewrites items.tsv and prs.tsv, and reads back', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', check: 'pid:5', atWrite: 'alive' });

  const prs = [
    {
      ref: 'bosunhq/bosun-app#64',
      opened: '2026-03-10T08:41:30Z',
      state: 'OPEN',
      seen: '2026-03-10T11:43:00Z',
    },
  ] as const;

  await writeCheckFiles(ctx.folder, {
    journal: [ctx.changedRow],
    items: [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' })],
    prs,
  });

  const read = await readStore(ctx.folder);

  const journal = readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8');

  expect([
    read.kind === 'store' && [read.store.items[0]?.last, read.store.prs],
    journal.endsWith('2026-03-10T11:43:00Z\tchanged\tt-a\tagent\talive -> gone\t-\t-\n'),
  ]).toStrictEqual([['gone', prs], true]);
});

test('it never opens session, notes.tsv or owner.tsv, and leaves a file it has nothing for as it was', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', check: 'pid:5', atWrite: 'alive' });

  seedStoreFile(ctx.folder, 'notes.tsv', 'id\towed\twritten\tnote\n');

  const before = await readTreeHashes(ctx.folder);

  const sessionMtimeMs = statSync(join(ctx.folder, 'session')).mtimeMs;

  await writeCheckFiles(ctx.folder, {
    journal: [ctx.changedRow],
    items: [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' })],
    prs: null,
  });

  const after = await readTreeHashes(ctx.folder);

  const changed = Object.keys(after).filter((path) => after[path] !== before[path]);

  expect([changed.toSorted(), statSync(join(ctx.folder, 'session')).mtimeMs]).toStrictEqual([
    ['items.tsv', 'journal.tsv'],
    sessionMtimeMs,
  ]);
});

test('it writes nothing when the save holds nothing', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  mkdirSync(ctx.folder, { recursive: true });
  appendFileSync(join(ctx.folder, 'journal.tsv'), '');

  const before = await readTreeHashes(ctx.folder);

  await writeCheckFiles(ctx.folder, { journal: [], items: null, prs: null });

  const after = await readTreeHashes(ctx.folder);

  expect(after).toStrictEqual(before);
});

test('it appends the journal before it rewrites items.tsv, and rewrites items.tsv before prs.tsv', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', check: 'pid:5', atWrite: 'alive' });

  const save = {
    journal: [ctx.changedRow],
    items: [buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' })],
    prs: [
      {
        ref: 'bosunhq/bosun-app#64',
        opened: '2026-03-10T08:41:30Z',
        state: 'OPEN',
        seen: '2026-03-10T11:43:00Z',
      },
    ],
  } as const;

  // a folder in the place of a file makes that file's rewrite fail, so what was written before it
  // shows the order
  const itemsPath = join(ctx.folder, 'items.tsv');
  const itemsText = readFileSync(itemsPath, 'utf8');
  const prsBefore = readFileSync(join(ctx.folder, 'prs.tsv'), 'utf8');

  rmSync(itemsPath);
  mkdirSync(join(itemsPath, 'inside'), { recursive: true });

  await expect(writeCheckFiles(ctx.folder, save)).rejects.toThrow();

  const afterItemsFailed = {
    journal: readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8').includes('alive -> gone'),
    prs: readFileSync(join(ctx.folder, 'prs.tsv'), 'utf8') !== prsBefore,
  };

  rmSync(itemsPath, { recursive: true });
  writeFileSync(itemsPath, itemsText);
  rmSync(join(ctx.folder, 'journal.tsv'), { force: true });
  rmSync(join(ctx.folder, 'prs.tsv'));
  mkdirSync(join(ctx.folder, 'prs.tsv', 'inside'), { recursive: true });

  await expect(writeCheckFiles(ctx.folder, save)).rejects.toThrow();

  const afterPrsFailed = {
    journal: existsSync(join(ctx.folder, 'journal.tsv')),
    items: readFileSync(itemsPath, 'utf8').includes('\tgone\t'),
  };

  expect([afterItemsFailed, afterPrsFailed]).toStrictEqual([
    { journal: true, prs: false },
    { journal: true, items: true },
  ]);
});
