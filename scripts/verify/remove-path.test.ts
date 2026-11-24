import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { createTempDir } from '@zgeoff/testing/fs';
import { makePath } from './make-path.ts';
import { removePath } from './remove-path.ts';

test('it removes the folder that makePath made, and refuses a second removal and a bad name', () => {
  const root = createTempDir('remove-path').path;
  const folder = makePath(root, 'dock-map');
  const removed = removePath(root, 'dock-map');
  const exists = existsSync(folder);

  expect([removed, exists]).toStrictEqual([folder, false]);
  expect(() => removePath(root, 'dock-map')).toThrow('is missing in this run');
  expect(() => removePath(root, 'A')).toThrow('must be 1 to 32 characters');
});
