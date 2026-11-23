import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStoreFile } from './seed-store-file.ts';

function setupTest() {
  return { folder: join(createTempDir('seed-file').path, 'tide-alerts') };
}

test('it writes the file, making the folder when it is missing', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'name=a\n');

  expect(readFileSync(join(ctx.folder, 'session'), 'utf8')).toBe('name=a\n');
});
