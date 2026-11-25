import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runGit } from '@zgeoff/testing/git';
import { seedHostileRepo } from './seed-hostile-repo.ts';

function setupTest() {
  const root = createTempDir('hostile-repo').path;

  return {
    root,
    seedHostileRepo: (setting: Parameters<typeof seedHostileRepo>[1]) =>
      seedHostileRepo(root, setting),
  };
}

test.each([
  { setting: 'filter.<d>.clean', folder: '', key: 'filter.x.clean', value: 'program.sh' },
  { setting: 'filter.<d>.process', folder: '', key: 'filter.x.process', value: 'program.sh' },
  { setting: 'filter.<d>.smudge', folder: '', key: 'filter.x.smudge', value: 'program.sh' },
  {
    setting: 'filter.<d>.clean in config.worktree',
    folder: '',
    key: 'filter.x.clean',
    value: 'program.sh',
  },
  {
    setting: 'filter.<d>.clean in an included file',
    folder: '',
    key: 'filter.x.clean',
    value: 'program.sh',
  },
  {
    setting: 'filter.<d> mapped in .git/info/attributes',
    folder: '',
    key: 'filter.x.clean',
    value: 'program.sh',
  },
  {
    setting: 'filter.<d>.clean in a submodule',
    folder: 'sub',
    key: 'filter.x.clean',
    value: 'program.sh',
  },
  { setting: 'core.hooksPath', folder: '', key: 'core.hooksPath', value: 'hooks' },
  { setting: 'diff.<d>.textconv', folder: '', key: 'diff.x.textconv', value: 'program.sh' },
  { setting: 'gpg.program', folder: '', key: 'gpg.program', value: 'program.sh' },
] as const)('it names the program with $setting, and the program has not run', async (row) => {
  const ctx = setupTest();

  const repo = await ctx.seedHostileRepo(row.setting);
  const value = await runGit(join(repo.folder, row.folder), repo.env, ['config', '--get', row.key]);

  expect({ value: value.trim(), ran: existsSync(repo.marker) }).toStrictEqual({
    value: join(ctx.root, row.value),
    ran: false,
  });
});

test('it gives the work tree as the probed path for a submodule', async () => {
  const ctx = setupTest();

  const submodule = await ctx.seedHostileRepo('filter.<d>.clean in a submodule');

  expect(submodule.probed).toBe(submodule.folder);
});

test('it gives kiln.txt as the probed path for a setting in the work tree', async () => {
  const ctx = setupTest();

  const repo = await ctx.seedHostileRepo('core.pager');

  expect(repo.probed).toBe(join(repo.folder, 'kiln.txt'));
});
