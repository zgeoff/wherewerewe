import { expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runGit } from '@zgeoff/testing/git';
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

test('it reads a file whose name holds glob characters by that name alone', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  writeFileSync(join(repo.folder, 'a[1].txt'), 'clean\n');
  writeFileSync(join(repo.folder, 'a1.txt'), 'dirty\n');

  await runGit(repo.folder, repo.env, ['add', 'a[1].txt', 'a1.txt']);
  await runGit(repo.folder, repo.env, ['commit', '--quiet', '-m', 'add two files']);

  writeFileSync(join(repo.folder, 'a1.txt'), 'changed\n');

  const probe = await ctx.probe(join(repo.folder, 'a[1].txt'));

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'clean' });
});

test('it never starts the fsmonitor helper that the repo config names', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const marker = join(ctx.root, 'helper-ran');
  const helper = join(ctx.root, 'helper.sh');

  writeFileSync(helper, `#!/bin/sh\necho ran > "${marker}"\n`);
  chmodSync(helper, 0o755);

  await runGit(repo.folder, repo.env, ['config', 'core.fsmonitor', helper]);

  await ctx.probe(repo.folder);

  expect(existsSync(marker)).toBe(false);
});

test('it reads unchecked with timeout when the stat of the path never returns', async () => {
  const ctx = setupTest();

  const probe = await probePath(
    { path: join(ctx.root, 'stalled') },
    () => Promise.reject(new Error('the probe ran a command')),
    () => new Promise(() => {}),
  );

  expect(probe.result).toStrictEqual({ kind: 'unchecked', reason: 'timeout' });
});

test('it gives git only what is left of the probe timeout after a slow stat', async () => {
  const ctx = setupTest();
  const timeouts: number[] = [];
  const startMs = performance.now();

  await probePath(
    { path: join(ctx.root, 'slow') },
    (_argv, timeoutMs) => {
      timeouts.push(timeoutMs);

      return Promise.resolve({ kind: 'timeout' });
    },
    async () => {
      await waitFor(() => {
        expect(performance.now() - startMs).toBeGreaterThanOrEqual(1100);
      });

      return { isDirectory: () => true };
    },
  );

  expect(timeouts.map((timeoutMs) => timeoutMs > 0 && timeoutMs < 1000)).toStrictEqual([true]);
});
