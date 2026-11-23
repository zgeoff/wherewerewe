import { expect, test } from 'bun:test';
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';

function setupTest() {
  const folder = createTempDir('packed-install').path;
  const repoRoot = join(import.meta.dir, '..', '..', '..');

  return {
    folder,
    source: join(folder, 'source'),
    cliSource: join(folder, 'source', 'packages', 'cli'),
    tarballs: join(folder, 'tarballs'),
    copyPackageSource: () => {
      mkdirSync(join(folder, 'source', 'packages', 'cli'), { recursive: true });
      cpSync(join(repoRoot, 'package.json'), join(folder, 'source', 'package.json'));
      cpSync(join(repoRoot, 'bun.lock'), join(folder, 'source', 'bun.lock'));

      cpSync(
        join(repoRoot, 'packages', 'cli', 'package.json'),
        join(folder, 'source', 'packages', 'cli', 'package.json'),
      );

      cpSync(
        join(repoRoot, 'packages', 'cli', 'src'),
        join(folder, 'source', 'packages', 'cli', 'src'),
        {
          recursive: true,
        },
      );
    },
    readHelpText: () =>
      run(['bun', join(repoRoot, 'packages', 'cli', 'src', 'cli.ts'), 'help'], {
        cwd: dirname(repoRoot),
      }),
  };
}

test('it installs a packed copy that runs as www and as wherewerewe after its source is removed', async () => {
  const ctx = setupTest();

  const globalEnv = {
    BUN_INSTALL_GLOBAL_DIR: join(ctx.folder, 'global'),
    BUN_INSTALL_BIN: join(ctx.folder, 'bin'),
  };

  ctx.copyPackageSource();

  const packed = await run(['bun', 'pm', 'pack', '--destination', ctx.tarballs], {
    cwd: ctx.cliSource,
  });

  const tarballs = readdirSync(ctx.tarballs).filter((name) => name.endsWith('.tgz'));

  const installed = await run(['bun', 'add', '-g', join(ctx.tarballs, tarballs[0] ?? '')], {
    cwd: ctx.folder,
    env: globalEnv,
  });

  rmSync(ctx.source, { recursive: true, force: true });

  const pathEnv = {
    PATH: [join(ctx.folder, 'bin'), dirname(process.execPath), '/usr/bin', '/bin'].join(':'),
  };

  const www = await run(['www', 'help'], { cwd: ctx.folder, env: pathEnv });
  const wherewerewe = await run(['wherewerewe', 'help'], { cwd: ctx.folder, env: pathEnv });
  const expected = await ctx.readHelpText();

  expect({
    tarballCount: tarballs.length,
    packed: packed.exitCode,
    installed: installed.exitCode,
    www: { exitCode: www.exitCode, stdout: www.stdout, stderr: www.stderr },
    wherewerewe: {
      exitCode: wherewerewe.exitCode,
      stdout: wherewerewe.stdout,
      stderr: wherewerewe.stderr,
    },
  }).toStrictEqual({
    tarballCount: 1,
    packed: 0,
    installed: 0,
    www: { exitCode: 0, stdout: expected.stdout, stderr: '' },
    wherewerewe: { exitCode: 0, stdout: expected.stdout, stderr: '' },
  });
});
