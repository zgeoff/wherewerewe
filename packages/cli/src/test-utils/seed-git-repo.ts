import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGitEnv, runGit } from '@zgeoff/testing/git';
import type { GitEnv } from '@zgeoff/testing/git';

export interface SeededRepo {
  // the work tree, with the branch main checked out and one commit on it
  readonly folder: string;

  // a bare repo that main tracks, with that commit pushed
  readonly remote: string;

  // the env to run git with in the work tree
  readonly env: GitEnv;
}

// A work tree whose branch main tracks a local bare remote, both under the root. No network.
export async function seedGitRepo(root: string): Promise<SeededRepo> {
  const env = readGitEnv(root);
  const folder = join(root, 'work');
  const remote = join(root, 'remote.git');

  mkdirSync(remote, { recursive: true });
  mkdirSync(folder, { recursive: true });

  await runGit(remote, env, ['init', '--quiet', '--bare', '-b', 'main']);
  await runGit(folder, env, ['init', '--quiet', '-b', 'main']);

  writeFileSync(join(folder, 'kiln.txt'), 'first\n');

  await runGit(folder, env, ['add', 'kiln.txt']);
  await runGit(folder, env, ['commit', '--quiet', '-m', 'add the kiln notes']);
  await runGit(folder, env, ['remote', 'add', 'origin', remote]);
  await runGit(folder, env, ['push', '--quiet', '--set-upstream', 'origin', 'main']);

  return { folder, remote, env };
}
