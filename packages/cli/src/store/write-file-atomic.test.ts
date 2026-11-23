import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { writeFileAtomic } from './write-file-atomic.ts';

function setupTest() {
  const folder = createTempDir('atomic').path;

  return { folder, path: join(folder, 'items.tsv') };
}

test('it replaces the file and leaves no temporary file behind', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'old');
  writeFileAtomic(ctx.path, 'new');

  expect(readFileSync(ctx.path, 'utf8')).toBe('new');
  expect(readdirSync(ctx.folder)).toStrictEqual(['items.tsv']);
});
