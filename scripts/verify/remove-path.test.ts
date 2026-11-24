import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

test('it refuses an entry that make-path did not make, and a link with its marker', () => {
  const root = createTempDir('remove-path-foreign').path;
  const outside = createTempDir('remove-path-outside').path;

  mkdirSync(join(root, 'paths', 'by-hand'), { recursive: true });
  symlinkSync(outside, join(root, 'paths', 'linked'));
  writeFileSync(join(root, 'paths', '.made-linked'), '');

  const messages = ['by-hand', 'linked'].map((name) => {
    try {
      removePath(root, name);

      return 'removed';
    } catch (error) {
      return error instanceof Error ? error.message : 'other';
    }
  });

  expect([messages, existsSync(join(root, 'paths', 'by-hand')), existsSync(outside)]).toStrictEqual(
    [
      [
        'The path by-hand was not made by `www make-path` in this run, so it is not removed.',
        'The path linked was not made by `www make-path` in this run, so it is not removed.',
      ],
      true,
      true,
    ],
  );
});

test('it refuses a paths folder that is a link out of the run', () => {
  const root = createTempDir('remove-path-link').path;
  const outside = createTempDir('remove-path-elsewhere').path;

  mkdirSync(join(outside, 'dock-map'));
  writeFileSync(join(outside, '.made-dock-map'), '');
  symlinkSync(outside, join(root, 'paths'));

  expect(() => removePath(root, 'dock-map')).toThrow('not a folder of its own');
  expect(existsSync(join(outside, 'dock-map'))).toBe(true);
});
