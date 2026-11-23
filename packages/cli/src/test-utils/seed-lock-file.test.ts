import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createLockFiles } from '../store/create-lock-files.ts';
import { seedLockFile } from './seed-lock-file.ts';

test('it returns what the lock module reads back from the file it wrote', () => {
  const folder = createTempDir('seed-lock').path;
  const seeded = seedLockFile(folder, 'lock', 'pid=1 ts=a\n');

  expect(createLockFiles().read(join(folder, 'lock'))).toStrictEqual(seeded);
});
