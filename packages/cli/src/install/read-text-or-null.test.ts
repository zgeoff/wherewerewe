import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { InstallReadError, readTextOrNull } from './read-text-or-null.ts';

function setupTest() {
  return { folder: createTempDir('read-text-or-null').path };
}

test('it reads the text of a file', () => {
  const ctx = setupTest();
  const path = join(ctx.folder, 'settings.json');

  writeFileSync(path, '{}');

  expect(readTextOrNull(path)).toBe('{}');
});

test('it returns null for a file that does not exist', () => {
  const ctx = setupTest();

  expect(readTextOrNull(join(ctx.folder, 'missing.json'))).toBeNull();
});

test('it throws for a folder in the place of a file', () => {
  const ctx = setupTest();
  const path = join(ctx.folder, 'settings.json');

  mkdirSync(path);

  expect(() => readTextOrNull(path)).toThrow(InstallReadError);
});

test('it throws for a file nobody may read', () => {
  const ctx = setupTest();
  const path = join(ctx.folder, 'settings.json');

  writeFileSync(path, '{}');
  chmodSync(path, 0o000);

  expect(() => readTextOrNull(path)).toThrow(InstallReadError);
});
