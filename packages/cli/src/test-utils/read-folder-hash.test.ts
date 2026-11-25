import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readFolderHash } from './read-folder-hash.ts';

function setupTest() {
  const folder = createTempDir('read-folder-hash').path;

  mkdirSync(join(folder, 'a'));
  writeFileSync(join(folder, 'a', 'one'), 'x');

  return { folder };
}

test('it gives the same hash for the same folder twice', () => {
  const ctx = setupTest();

  expect(readFolderHash(ctx.folder)).toBe(readFolderHash(ctx.folder));
});

test.each([
  {
    title: 'a changed byte',
    change: (folder: string) => writeFileSync(join(folder, 'a', 'one'), 'y'),
  },
  { title: 'a new file', change: (folder: string) => writeFileSync(join(folder, 'two'), '') },
  {
    title: 'a changed mode',
    change: (folder: string) => chmodSync(join(folder, 'a', 'one'), 0o600),
  },
  { title: 'a new folder', change: (folder: string) => mkdirSync(join(folder, 'b')) },
])('it gives another hash after $title', (row) => {
  const ctx = setupTest();
  const before = readFolderHash(ctx.folder);

  row.change(ctx.folder);

  expect(readFolderHash(ctx.folder)).not.toBe(before);
});
