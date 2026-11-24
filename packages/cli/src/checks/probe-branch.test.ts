import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { createGitCommit, runGit } from '@zgeoff/testing/git';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
import type { SeededRepo } from '../test-utils/seed-git-repo.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { probeBranch } from './probe-branch.ts';
import { createKillSet, runCommand } from './run-command.ts';
import type { RunProbeCommand } from './types.ts';

function setupTest() {
  const root = createTempDir('probe-branch').path;
  const bin = join(root, 'bin');

  const run: RunProbeCommand = (argv, timeoutMs) =>
    runCommand(argv, { env: { PATH: bin }, timeoutMs, kills: createKillSet() });

  return {
    root,
    bin,
    createRepo: () => {
      mkdirSync(bin, { recursive: true });
      linkCommands(bin, ['git']);

      return seedGitRepo(root);
    },
    probe: (repoPath: string, name: string) => probeBranch({ repoPath, name }, run),
    commit: (repo: SeededRepo, file: string) =>
      createGitCommit(repo.folder, repo.env, {
        [file]: `${file}
`,
      }),
  };
}

test('it reads pushed for a branch level with its upstream', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();
  const probe = await ctx.probe(repo.folder, 'main');

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'pushed' });
});

test('it reads ahead 2 for a branch with 2 commits its upstream lacks', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await ctx.commit(repo, 'one.txt');
  await ctx.commit(repo, 'two.txt');

  const probe = await ctx.probe(repo.folder, 'main');

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'ahead 2' });
});

test('it reads behind 1 for a branch whose upstream holds a commit it lacks', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await ctx.commit(repo, 'one.txt');

  await runGit(repo.folder, repo.env, ['push', '--quiet', 'origin', 'main']);
  await runGit(repo.folder, repo.env, ['reset', '--quiet', '--hard', 'HEAD~1']);

  const probe = await ctx.probe(repo.folder, 'main');

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'behind 1' });
});

test('it reads diverged for a branch and an upstream that each hold a commit the other lacks', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await ctx.commit(repo, 'one.txt');

  await runGit(repo.folder, repo.env, ['push', '--quiet', 'origin', 'main']);
  await runGit(repo.folder, repo.env, ['reset', '--quiet', '--hard', 'HEAD~1']);

  await ctx.commit(repo, 'two.txt');

  const probe = await ctx.probe(repo.folder, 'main');

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'diverged' });
});

test('it reads no upstream for a branch that tracks nothing', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await runGit(repo.folder, repo.env, ['branch', 'dock-map']);

  const probe = await ctx.probe(repo.folder, 'dock-map');

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'no upstream' });
});

test('it reads gone for a branch that does not exist, and for a repo path that does not exist', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const probes = [
    await ctx.probe(repo.folder, 'dock-map'),
    await ctx.probe(join(ctx.root, 'nothing'), 'main'),
  ];

  expect(probes.map((probe) => probe.result)).toStrictEqual([
    { kind: 'result', result: 'gone' },
    { kind: 'result', result: 'gone' },
  ]);
});

test('it reads unchecked with git missing when no git is on the PATH', async () => {
  const ctx = setupTest();

  const probe = await ctx.probe(ctx.root, 'main');

  expect(probe.result).toStrictEqual({ kind: 'unchecked', reason: 'git missing' });
});

test('it reads unchecked, and never prints git output, when rev-list prints text that is not two integers', async () => {
  const ctx = setupTest();

  seedStubCommand(
    ctx.bin,
    'git',
    `case "$3" in
  rev-parse) exit 0 ;;
  rev-list) echo 'fatal: password hunter2' ;;
esac`,
  );

  const probe = await ctx.probe(ctx.root, 'main');

  expect(probe).toStrictEqual({
    result: { kind: 'unchecked', reason: 'git missing' },
    failing: [],
  });
});
