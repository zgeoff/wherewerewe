import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { runGit } from '@zgeoff/testing/git';
import { seedGitRepo } from './seed-git-repo.ts';

test('it seeds a work tree whose main is pushed to a local bare remote', async () => {
  const repo = await seedGitRepo(createTempDir('git-repo').path);

  const counts = await runGit(repo.folder, repo.env, [
    'rev-list',
    '--left-right',
    '--count',
    'main...main@{upstream}',
  ]);

  const status = await runGit(repo.folder, repo.env, ['status', '--porcelain']);

  expect([counts.trim(), status]).toStrictEqual(['0\t0', '']);
});
