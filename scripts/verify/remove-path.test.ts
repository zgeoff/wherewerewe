import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { makePath } from './make-path.ts';
import { readPathIdentity } from './read-path-identity.ts';
import { removePath } from './remove-path.ts';

function setupTest() {
  return {
    root: createTempDir('remove-path').path,
    outside: createTempDir('remove-path-outside').path,
  };
}

test('it removes the folder that makePath made, and refuses a second removal and a bad name', () => {
  const ctx = setupTest();
  const folder = makePath(ctx.root, 'dock-map');
  const removed = removePath(ctx.root, 'dock-map');
  const exists = existsSync(folder);

  expect([removed, exists]).toStrictEqual([folder, false]);
  expect(() => removePath(ctx.root, 'dock-map')).toThrow('is missing in this run');
  expect(() => removePath(ctx.root, 'A')).toThrow('must be 1 to 32 characters');
});

test('it refuses an entry that make-path did not make, and a link with its marker', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.root, 'paths', 'by-hand'), { recursive: true });
  symlinkSync(ctx.outside, join(ctx.root, 'paths', 'linked'));
  writeFileSync(join(ctx.root, 'paths', '.made-linked'), '');

  const messages = ['by-hand', 'linked'].map((name) => {
    try {
      removePath(ctx.root, name);

      return 'removed';
    } catch (error) {
      return error instanceof Error ? error.message : 'other';
    }
  });

  expect([
    messages,
    existsSync(join(ctx.root, 'paths', 'by-hand')),
    existsSync(ctx.outside),
  ]).toStrictEqual([
    [
      'The path by-hand was not made by `www make-path` in this run, so it is not removed.',
      'The path linked was not made by `www make-path` in this run, so it is not removed.',
    ],
    true,
    true,
  ]);
});

test('it refuses a paths folder that is a link out of the run', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.outside, 'dock-map'));
  writeFileSync(join(ctx.outside, '.made-dock-map'), '');
  symlinkSync(ctx.outside, join(ctx.root, 'paths'));

  expect(() => removePath(ctx.root, 'dock-map')).toThrow('not a folder of its own');
  expect(existsSync(join(ctx.outside, 'dock-map'))).toBe(true);
});

test('it refuses a folder that replaced the one make-path made, while the marker stays', () => {
  const ctx = setupTest();
  const folder = makePath(ctx.root, 'dock-map');

  renameSync(folder, join(ctx.root, 'paths', 'moved'));
  mkdirSync(folder);
  writeFileSync(join(folder, 'keep.txt'), 'by hand\n');

  expect(() => removePath(ctx.root, 'dock-map')).toThrow(
    'was not made by `www make-path` in this run',
  );

  expect(existsSync(join(folder, 'keep.txt'))).toBe(true);
});

test('it sets aside a folder swapped in after the identity check, with its files, and removes nothing', () => {
  const ctx = setupTest();
  const folder = makePath(ctx.root, 'dock-map');
  const reads = { count: 0 };

  const swapAfterFirstRead = (path: string): string => {
    const identity = readPathIdentity(path);

    reads.count += 1;

    if (reads.count === 1) {
      renameSync(folder, join(ctx.root, 'paths', 'moved'));
      mkdirSync(folder);
      writeFileSync(join(folder, 'keep.txt'), 'by hand\n');
    }

    return identity;
  };

  expect(() => removePath(ctx.root, 'dock-map', swapAfterFirstRead)).toThrow(
    'was not made by `www make-path` in this run',
  );

  expect([
    existsSync(folder),
    readdirSync(join(ctx.root, 'paths'))
      .filter((name) => name.endsWith('.kept'))
      .flatMap((name) => readdirSync(join(ctx.root, 'paths', name))),
    readdirSync(join(ctx.root, 'paths'))
      .filter((name) => !name.endsWith('.kept'))
      .toSorted(),
  ]).toStrictEqual([false, ['keep.txt'], ['.made-dock-map', 'moved']]);
});

test('it never replaces a folder that takes the name while a refused entry is put aside', () => {
  const ctx = setupTest();
  const folder = makePath(ctx.root, 'dock-map');
  const reads = { count: 0 };

  const swapAfterFirstRead = (path: string): string => {
    const identity = readPathIdentity(path);

    reads.count += 1;

    if (reads.count === 1) {
      renameSync(folder, join(ctx.root, 'paths', 'moved'));
      mkdirSync(folder);
      writeFileSync(join(folder, 'first.txt'), 'by hand\n');
    }

    return identity;
  };

  // an empty folder takes the name just before the refused entry is moved off it, as another
  // process could do, and a rename replaces an empty folder
  const renameWhileFolderTakesName = (from: string, to: string) => {
    if (from !== folder) {
      mkdirSync(folder);
    }

    renameSync(from, to);
  };

  expect(() =>
    removePath(ctx.root, 'dock-map', swapAfterFirstRead, renameWhileFolderTakesName),
  ).toThrow('was not made by `www make-path` in this run');

  expect([
    readdirSync(folder),
    readdirSync(join(ctx.root, 'paths'))
      .filter((name) => name.endsWith('.kept'))
      .flatMap((name) => readdirSync(join(ctx.root, 'paths', name))),
  ]).toStrictEqual([[], ['first.txt']]);
});
