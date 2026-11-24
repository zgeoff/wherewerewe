import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
import { probePath } from './probe-path.ts';
import { createKillSet, runCommand } from './run-command.ts';

function setupTest() {
  const root = createTempDir('probe-path').path;
  const bin = join(root, 'bin');
  const emptyBin = join(root, 'empty-bin');

  mkdirSync(emptyBin, { recursive: true });
  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  return {
    root,
    createRepo: () => seedGitRepo(root),
    probe: (path: string, pathEnv: string = bin) =>
      probePath({ path }, (argv, timeoutMs) =>
        runCommand(argv, { env: { PATH: pathEnv }, timeoutMs, kills: createKillSet() }),
      ),
    emptyBin,
  };
}

test('it reads clean for a folder of a work tree with no change', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();
  const probe = await ctx.probe(repo.folder);

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'clean' });
});

test('it reads dirty for a folder of a work tree with an untracked file', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  writeFileSync(join(repo.folder, 'scratch.txt'), 'new\n');

  const probe = await ctx.probe(repo.folder);

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'dirty' });
});

test('it reads exists for a folder outside a work tree', async () => {
  const ctx = setupTest();
  const folder = join(ctx.root, 'plain');

  mkdirSync(folder);

  const probe = await ctx.probe(folder);

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'exists' });
});

test('it reads missing for a path that does not exist', async () => {
  const ctx = setupTest();

  const probe = await ctx.probe(join(ctx.root, 'nothing'));

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'missing' });
});

test('it reads a subfolder clean while the work tree holds a change elsewhere', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const subfolder = join(repo.folder, 'docks');

  mkdirSync(subfolder);
  writeFileSync(join(repo.folder, 'scratch.txt'), 'new\n');

  const probe = await ctx.probe(subfolder);

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'clean' });
});

test('it reads a file by its own state: clean when tracked and unchanged, dirty once it changes', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const file = join(repo.folder, 'kiln.txt');

  const clean = await ctx.probe(file);

  writeFileSync(file, 'changed\n');

  const dirty = await ctx.probe(file);

  expect([clean.result, dirty.result]).toStrictEqual([
    { kind: 'result', result: 'clean' },
    { kind: 'result', result: 'dirty' },
  ]);
});

test('it reads exists when no git is on the PATH', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();
  const probe = await ctx.probe(repo.folder, ctx.emptyBin);

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'exists' });
});
