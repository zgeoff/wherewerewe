import { expect, test } from 'bun:test';
import { existsSync, symlinkSync } from 'node:fs';
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

test('it refuses to make a path when the paths folder of the run is a link', () => {
  const root = createTempDir('make-path-link').path;
  const outside = createTempDir('make-path-elsewhere').path;

  symlinkSync(outside, join(root, 'paths'));

  expect(() => makePath(root, 'dock-map')).toThrow('not a folder of its own');
  expect(existsSync(join(outside, 'dock-map'))).toBe(false);
});
