import { expect, test } from 'bun:test';
import { chmodSync, copyFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { buildCompileArgv } from '../../../scripts/binaries/build-compile-argv.ts';
import { pickHostTarget } from '../../../scripts/binaries/pick-host-target.ts';

function setupTest() {
  const folder = createTempDir('compiled-binary').path;
  const repoRoot = join(import.meta.dir, '..', '..', '..');
  const binFolder = join(folder, 'bin');

  const env = {
    PATH: binFolder,
    HOME: join(folder, 'home'),
    XDG_STATE_HOME: join(folder, 'state'),

    // an agent's shell runs this test too, and its session must not bind
    CLAUDE_CODE_SESSION_ID: '',
    CODEX_SESSION_ID: '',
    CODEX_THREAD_ID: '',
    WHEREWEREWE_SESSION: '',
  };

  return {
    buildFolder: join(folder, 'build'),
    binFolder,

    // The binary under test: the one WHEREWEREWE_BIN names, or one compiled here for this machine.
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
    www: async (name: 'www' | 'wherewerewe', argv: readonly string[]) => {
      const output = await run([join(binFolder, name), ...argv], { cwd: folder, env });

      return { exitCode: output.exitCode, stdout: output.stdout };
    },
  };
}

test('it writes a row and reads the brief as www and as wherewerewe after its build folder is removed', async () => {
  const ctx = setupTest();

  const binary = await ctx.readBinary(ctx.buildFolder);

  mkdirSync(ctx.binFolder);
  copyFileSync(binary, join(ctx.binFolder, 'wherewerewe'));
  chmodSync(join(ctx.binFolder, 'wherewerewe'), 0o755);
  symlinkSync('wherewerewe', join(ctx.binFolder, 'www'));
  rmSync(ctx.buildFolder, { recursive: true, force: true });

  const started = await ctx.www('www', ['init', 'dock-map', '--goal', 'Ship the dock map']);
  const written = await ctx.www('wherewerewe', ['--session', 'dock-map', 'task', 'Draw the docks']);
  const brief = await ctx.www('www', ['--session', 'dock-map']);
  const rows = await ctx.www('wherewerewe', ['--session', 'dock-map', 'rows']);

  expect({
    started,
    written,
    briefExit: brief.exitCode,
    briefLines: brief.stdout.split('\n').slice(1, 3),
    labels: rows.stdout
      .trim()
      .split('\n')
      .map((line) => line.replace(/^.*"label":"(?<label>[a-z]+)".*$/u, '$<label>')),
  }).toStrictEqual({
    started: { exitCode: 0, stdout: '{"ok":true,"session":"dock-map","bound":false}\n' },
    written: { exitCode: 0, stdout: '{"ok":true,"id":"task-1","label":"task"}\n' },
    briefExit: 0,
    briefLines: ['GOAL   Ship the dock map', 'TASK   task-1  Draw the docks'],
    labels: ['goal', 'task'],
  });
});
