import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createFilterRepo } from './create-filter-repo.ts';

function setupTest() {
  const root = createTempDir('filter-repo').path;

  return {
    root,
    createFilterRepo: (name: string) => createFilterRepo(root, name),
  };
}

test('it makes a repo whose own filter runs on a git status and creates the marker', () => {
  const ctx = setupTest();
  const folder = ctx.createFilterRepo('tide-repo');
  const before = existsSync(join(ctx.root, 'paths', 'tide-repo-ran'));

  const status = Bun.spawnSync(['git', '-C', folder, 'status', '--porcelain'], {
    env: { PATH: process.env['PATH'] ?? '', HOME: folder, GIT_CONFIG_GLOBAL: '/dev/null' },
  });

  expect({
    folder,
    before,
    exitCode: status.exitCode,
    after: existsSync(join(ctx.root, 'paths', 'tide-repo-ran')),
  }).toStrictEqual({
    folder: join(ctx.root, 'paths', 'tide-repo'),
    before: false,
    exitCode: 0,
    after: true,
  });
});
