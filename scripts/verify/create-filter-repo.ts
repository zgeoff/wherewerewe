import { utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';
import { makePath } from './make-path.ts';

// Makes `<run>/paths/<name>` a git repo with a committed chart.txt that .gitattributes maps to the
// filter driver x. After the commit, the repo's own config sets x's clean command to one that
// creates `<run>/paths/<name>-ran`, and chart.txt is touched, so a git status would run it.
export function createFilterRepo(stateRoot: string, name: string): string {
  const folder = makePath(stateRoot, name);
  const marker = join(stateRoot, 'paths', `${name}-ran`);
  const git = (args: readonly string[]) => runGit(folder, args);

  git(['init', '--quiet', '-b', 'main']);
  writeFileSync(join(folder, '.gitattributes'), '*.txt filter=x\n');
  writeFileSync(join(folder, 'chart.txt'), 'tide chart\n');
  git(['add', '.gitattributes', 'chart.txt']);
  git(['commit', '--quiet', '-m', 'add the tide chart']);
  git(['config', 'filter.x.clean', `sh -c ': > "${marker}"; cat'`]);

  const later = new Date(Date.now() + 2000);

  utimesSync(join(folder, 'chart.txt'), later, later);

  return folder;
}

// Runs git with no config of the owner's, so the repo holds only what this file writes.
function runGit(folder: string, args: readonly string[]): void {
  const result = Bun.spawnSync(['git', '-C', folder, ...args], {
    env: {
      PATH: process.env['PATH'] ?? '',
      HOME: folder,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Trial',
      GIT_AUTHOR_EMAIL: 'trial@example.invalid',
      GIT_COMMITTER_NAME: 'Trial',
      GIT_COMMITTER_EMAIL: 'trial@example.invalid',
    },
    stdin: 'ignore',
  });

  if (result.exitCode !== 0) {
    throw new WringerError('check-failed', {
      message: `git ${args.join(' ')} exited ${String(result.exitCode)}: ${result.stderr.toString()}`,
    });
  }
}
