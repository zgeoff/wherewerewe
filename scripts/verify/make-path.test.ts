import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { makePath } from './make-path.ts';

test('it makes the folder under paths in the run and returns it', () => {
  const root = createTempDir('make-path').path;
  const folder = makePath(root, 'dock-map');

  expect([folder, existsSync(folder)]).toStrictEqual([join(root, 'paths', 'dock-map'), true]);
});

test('it refuses a name that exists, and a name outside 1 to 32 characters of a-z, 0-9 and a hyphen', () => {
  const root = createTempDir('make-path-refuse').path;

  makePath(root, 'dock-map');

  expect(
    [
      () => makePath(root, 'dock-map'),
      () => makePath(root, '../out'),
      () => makePath(root, ''),
    ].map((attempt) => {
      try {
        attempt();

        return 'made';
      } catch (error) {
        return error instanceof Error ? error.message.slice(0, 20) : 'other';
      }
    }),
  ).toStrictEqual(['The path dock-map ex', 'The path name "../ou', 'The path name "" mus']);
});
