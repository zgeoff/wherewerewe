import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { removeLockIf } from './remove-lock-if.ts';

function setupTest() {
  const folder = createTempDir('remove-lock').path;

  return { folder, lockPath: join(folder, 'lock') };
}

test('it removes the lock that holds the expected content', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'lock', 'pid=1 ts=a\n');

  const isRemoved = removeLockIf(ctx.lockPath, 'pid=1 ts=a\n');

  expect({ isRemoved, left: readdirSync(ctx.folder) }).toStrictEqual({
    isRemoved: true,
    left: [],
  });
});

test('it leaves a lock that a new holder wrote in place of the one judged stale', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'lock', 'pid=2 ts=fresh\n');

  const isRemoved = removeLockIf(ctx.lockPath, 'pid=1 ts=stale\n');

  expect({
    isRemoved,
    left: readdirSync(ctx.folder),
    content: readFileSync(ctx.lockPath, 'utf8'),
  }).toStrictEqual({ isRemoved: false, left: ['lock'], content: 'pid=2 ts=fresh\n' });
});

test('it reports false when there is no lock', () => {
  const ctx = setupTest();

  expect(removeLockIf(ctx.lockPath, 'pid=1 ts=a\n')).toBe(false);
});
