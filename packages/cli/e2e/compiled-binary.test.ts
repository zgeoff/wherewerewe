import { expect, test } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { z } from 'zod';
import { buildCompileArgv } from '../../../scripts/binaries/build-compile-argv.ts';
import { pickHostTarget } from '../../../scripts/binaries/pick-host-target.ts';
import { helpText } from '../src/args/help-text.ts';

function setupTest() {
  const folder = createTempDir('compiled-binary').path;
  const repoRoot = join(import.meta.dir, '..', '..', '..');

  return {
    folder,
    buildFolder: join(folder, 'build'),
    binFolder: join(folder, 'bin'),
    env: {
      PATH: join(folder, 'bin'),
      HOME: join(folder, 'home'),
      XDG_STATE_HOME: join(folder, 'state'),
    },

    // The binary under test: the one WHEREWEREWE_BIN names, or one compiled here for this machine.
    // A compiled copy stands in the build folder until the test removes it.
    readBinary: async (buildFolder: string) => {
      const given = process.env['WHEREWEREWE_BIN'];

      if (given !== undefined && given !== '') {
        return given;
      }

      const target = pickHostTarget(process.platform, process.arch);

      if (target === null) {
        throw new Error(`no binary builds for ${process.platform} ${process.arch}`);
      }

      const compiled = await run(buildCompileArgv(target, buildFolder), { cwd: repoRoot });

      expect(compiled.exitCode).toBe(0);

      return join(buildFolder, `wherewerewe-${target}`);
    },
    readVersion: async () => {
      const manifestJSON: unknown = await Bun.file(
        join(repoRoot, 'packages', 'cli', 'package.json'),
      ).json();

      return z.object({ version: z.string() }).parse(manifestJSON).version;
    },
  };
}

test('it runs a compiled binary as www and as wherewerewe after its build folder is removed', async () => {
  const ctx = setupTest();

  const binary = await ctx.readBinary(ctx.buildFolder);

  mkdirSync(ctx.binFolder);
  copyFileSync(binary, join(ctx.binFolder, 'wherewerewe'));
  chmodSync(join(ctx.binFolder, 'wherewerewe'), 0o755);
  symlinkSync('wherewerewe', join(ctx.binFolder, 'www'));
  rmSync(ctx.buildFolder, { recursive: true, force: true });

  const www = await run(['www', 'help'], { cwd: ctx.folder, env: ctx.env });
  const wherewerewe = await run(['wherewerewe', 'help'], { cwd: ctx.folder, env: ctx.env });
  const version = await run(['www', '--version'], { cwd: ctx.folder, env: ctx.env });

  const beside = await run(['www', '--session', 'tide-alerts', '--version'], {
    cwd: ctx.folder,
    env: ctx.env,
  });

  const expectedVersion = await ctx.readVersion();

  expect({
    www: { exitCode: www.exitCode, stdout: www.stdout, stderr: www.stderr },
    wherewerewe: {
      exitCode: wherewerewe.exitCode,
      stdout: wherewerewe.stdout,
      stderr: wherewerewe.stderr,
    },
    version: { exitCode: version.exitCode, stdout: version.stdout, stderr: version.stderr },
    beside: { exitCode: beside.exitCode, stdout: beside.stdout, stderr: beside.stderr },
  }).toStrictEqual({
    www: { exitCode: 0, stdout: helpText, stderr: '' },
    wherewerewe: { exitCode: 0, stdout: helpText, stderr: '' },
    version: { exitCode: 0, stdout: `wherewerewe ${expectedVersion}\n`, stderr: '' },
    beside: {
      exitCode: 2,
      stdout: '',
      stderr:
        'www: the brief takes no --version flag. It takes --json.\nRun: www --session tide-alerts\n',
    },
  });
});

test('it loads no bunfig.toml, .env or preload from the folder it starts in', async () => {
  const ctx = setupTest();
  const repo = join(ctx.folder, 'repo');
  const marker = join(ctx.folder, 'preload-ran');

  const binary = await ctx.readBinary(ctx.buildFolder);

  mkdirSync(ctx.binFolder);
  copyFileSync(binary, join(ctx.binFolder, 'wherewerewe'));
  chmodSync(join(ctx.binFolder, 'wherewerewe'), 0o755);
  mkdirSync(repo);

  // a repo the agent works in may hold any of these, and none of its code may run inside www
  writeFileSync(
    join(repo, 'preload.ts'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '');\n`,
  );

  writeFileSync(join(repo, 'bunfig.toml'), 'preload = ["./preload.ts"]\n');
  writeFileSync(join(repo, '.env'), 'XDG_STATE_HOME=/nonexistent-state\n');

  const version = await run(['wherewerewe', '--version'], { cwd: repo, env: ctx.env });
  const expectedVersion = await ctx.readVersion();

  expect({
    exitCode: version.exitCode,
    stdout: version.stdout,
    stderr: version.stderr,
    isPreloadRun: existsSync(marker),
  }).toStrictEqual({
    exitCode: 0,
    stdout: `wherewerewe ${expectedVersion}\n`,
    stderr: '',
    isPreloadRun: false,
  });
});
