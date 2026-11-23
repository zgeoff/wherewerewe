import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readTreeHashes } from './read-tree-hashes.ts';

function setupTest() {
  const root = createTempDir('tree-hashes').path;

  return {
    root,
    seedFile: (path: string, text: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    },
  };
}

test('it maps each file, hidden folders included, to the SHA-256 of its content', async () => {
  const ctx = setupTest();

  ctx.seedFile('alpha/items.tsv', 'abc');
  ctx.seedFile('.bindings/claude-1', 'name=alpha\n');

  const hashes = await readTreeHashes(ctx.root);

  expect(hashes).toStrictEqual({
    'alpha/items.tsv': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    '.bindings/claude-1': expect.stringMatching(/^[0-9a-f]{64}$/u),
  });
});

test('it returns nothing for a root that does not exist', async () => {
  const ctx = setupTest();

  const hashes = await readTreeHashes(join(ctx.root, 'missing'));

  expect(hashes).toStrictEqual({});
});
