import { expect, onTestFinished, test } from 'bun:test';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

test('it makes the temporary file with the requested mode, whatever the umask, before any text', () => {
  const ctx = setupTest();
  const before = process.umask(0o022);

  onTestFinished(() => {
    process.umask(before);
  });

  const seen: { mode: number; size: number }[] = [];

  writeFileAtomic(ctx.path, 'secret', 0o600, {
    afterOpen: (temporaryPath) => {
      const info = statSync(temporaryPath);

      seen.push({ mode: info.mode % 0o1000, size: info.size });
    },
  });

  expect(seen).toStrictEqual([{ mode: 0o600, size: 0 }]);
  expect(statSync(ctx.path).mode % 0o1000).toBe(0o600);
});

test('it keeps the old file and drops the temporary file when the check before the rename fails', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'old');

  const isWritten = writeFileAtomic(ctx.path, 'new', undefined, { isStillValid: () => false });

  expect({
    isWritten,
    text: readFileSync(ctx.path, 'utf8'),
    files: readdirSync(ctx.folder),
  }).toStrictEqual({ isWritten: false, text: 'old', files: ['items.tsv'] });
});
