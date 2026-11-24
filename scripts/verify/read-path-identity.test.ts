import { expect, test } from 'bun:test';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readPathIdentity } from './read-path-identity.ts';

test('it gives a folder the same identity twice, and a folder that replaces it another', () => {
  const root = createTempDir('read-path-identity').path;
  const folder = join(root, 'dock-map');

  mkdirSync(folder);

  const first = readPathIdentity(folder);
  const second = readPathIdentity(folder);

  renameSync(folder, join(root, 'moved'));
  mkdirSync(folder);

  expect([first === second, readPathIdentity(folder) === first]).toStrictEqual([true, false]);
});
