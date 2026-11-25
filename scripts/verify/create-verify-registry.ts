import { join } from 'node:path';
import { WringerError, createWringer, local } from '@wringer/core';
import type { Wringer } from '@wringer/core';
import { z } from 'zod';
import { pickHostTarget } from '../binaries/pick-host-target.ts';
import { readReleaseVersion } from '../ship/read-release-version.ts';
import { buildPackageInstallArgv } from './build-package-install-argv.ts';
import { buildPackageRunArgv } from './build-package-run-argv.ts';
import { buildWWWArgv } from './build-www-argv.ts';
import { checkPackageInstall } from './check-package-install.ts';
import { checkPackageRun } from './check-package-run.ts';
import { fillRunFolder } from './fill-run-folder.ts';
import { parseWWWLine } from './parse-www-line.ts';
import { readStateRoot } from './read-state-root.ts';
import { readWWWOutput } from './read-www-output.ts';
import { runPackageBuild } from './run-package-build.ts';
import { runWWWHook } from './run-www-hook.ts';
import { runWWWLine } from './run-www-line.ts';

const repoRoot = join(import.meta.dir, '..', '..');

const wwwRunSchema = z.strictObject({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
});

// `www` has no server, so `local` launches a process that only holds the run open, and its ready
// line hands over the run's folder under .wringer/. gunshi reads a command group named like the
// program as the program itself, so the registry's name differs from the `www` group.
export function createVerifyRegistry(): Wringer {
  return createWringer({ name: 'wherewerewe-verify' })
    .target('local', {
      mode: 'launch',
      access: 'read-write',
      host: local(),
      launch: (ctx) => ({
        command: ['bun', '-e', "console.log('ready'); setInterval(() => {}, 1_000_000);"],
        ready: (line) => (line['message'] === 'ready' ? { stateRoot: ctx.runDirectory } : null),
      }),
    })
    .command({
      path: ['www', 'run'],
      summary:
        'Run the `www` command line --line, and check that it exits 0 and prints --expect; {run} in either is the run folder',
      args: z.strictObject({
        line: z.string(),
        expect: z.string(),
        host: z.enum(['claude', 'codex']).optional(),
      }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const stateRoot = readStateRoot(ctx.endpoints);
        const line = args.line;
        const expected = fillRunFolder(args.expect, stateRoot);

        const output = await runWWWLine(ctx.exec, stateRoot, line, args.host);

        if (output.exitCode !== 0 || !output.stdout.includes(expected)) {
          throw new WringerError('check-failed', {
            message: `${line} exited ${String(output.exitCode)} and printed ${JSON.stringify(output.stdout + output.stderr)}, which lacks ${JSON.stringify(expected)}`,
          });
        }

        return output;
      },
    })
    .command({
      path: ['www', 'hook'],
      summary:
        'Pipe the JSON --payload into `www hook <harness>` with the run home; {run} is the run folder; check that it exits 0 and prints --expect, or nothing with --empty',
      args: z.strictObject({
        harness: z.enum(['claude', 'codex']),
        payload: z.string(),
        expect: z.string().optional(),
        empty: z.boolean().optional(),
      }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await runWWWHook(
          ctx.exec,
          readStateRoot(ctx.endpoints),
          args.harness,
          args.payload,
        );

        const isOk =
          output.exitCode === 0 &&
          (args.empty === true
            ? output.stdout === ''
            : output.stdout.includes(args.expect ?? '\u0000'));

        if (!isOk) {
          throw new WringerError('check-failed', {
            message: `www hook ${args.harness} exited ${String(output.exitCode)} and printed ${JSON.stringify(output.stdout + output.stderr)}`,
          });
        }

        return output;
      },
    })
    .command({
      path: ['www', 'refuse'],
      summary:
        'Run --line, and check that www refuses it with exit 2 and that its stderr holds --expect',
      args: z.strictObject({ line: z.string(), expect: z.string() }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await runWWWLine(ctx.exec, readStateRoot(ctx.endpoints), args.line);

        if (output.exitCode !== 2 || !output.stderr.includes(args.expect)) {
          throw new WringerError('check-failed', {
            message: `${args.line} exited ${String(output.exitCode)} with ${JSON.stringify(output.stderr)}`,
          });
        }

        return output;
      },
    })
    .command({
      path: ['package', 'build'],
      summary: 'Compile the binary for this machine into <run>/release, with its SHA256SUMS',
      effect: 'write',
      args: z.strictObject({}),
      data: z.strictObject({ target: z.string() }),
      run: async (_args, ctx) => {
        const target = await runPackageBuild({
          root: repoRoot,
          releaseFolder: join(readStateRoot(ctx.endpoints), 'release'),
          platform: process.platform,
          arch: process.arch,
          runCommand: (argv, cwd) =>
            Bun.spawn([...argv], { cwd, stdio: ['ignore', 'ignore', 'inherit'] }).exited,
        });

        return { target };
      },
    })
    .command({
      path: ['package', 'install'],
      summary:
        'Run install.sh against <run>/release, into <run>/bin, and check that it exits 0 and prints exactly its download, installed and PATH lines',
      effect: 'write',
      args: z.strictObject({}),
      data: wwwRunSchema,
      run: async (_args, ctx) => {
        const stateRoot = readStateRoot(ctx.endpoints);
        const target = pickHostTarget(process.platform, process.arch) ?? 'none';

        const version = await readReleaseVersion(repoRoot);

        const output = await ctx.exec(
          buildPackageInstallArgv(stateRoot, join(repoRoot, 'install.sh')),
        );

        checkPackageInstall(output, { stateRoot, target, version });

        return { exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr };
      },
    })
    .command({
      path: ['package', 'run'],
      summary:
        'Run the installed binary --name (www or wherewerewe) with the words of --line, and check that it exits 0 and that its first line is exactly --expect, where {version} stands for the package version',
      effect: 'write',
      args: z.strictObject({
        name: z.enum(['www', 'wherewerewe']),
        line: z.string(),
        expect: z.string(),
      }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await ctx.exec(
          buildPackageRunArgv(
            readStateRoot(ctx.endpoints),
            args.name,
            parseWWWLine(`www ${args.line}`),
          ),
        );

        const version = await readReleaseVersion(repoRoot);

        checkPackageRun(
          `${args.name} ${args.line}`,
          output,
          args.expect.replaceAll('{version}', version),
        );

        return { exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr };
      },
    })
    .check({
      name: 'www-help',
      input: z.strictObject({}),
      data: z.null(),
      timeoutMs: 10_000,

      // the doctor refuses `ctx.exec` in a check, so this check starts `www help` with Bun.spawn
      run: async (_input, ctx) => {
        const child = Bun.spawn([...buildWWWArgv(readStateRoot(ctx.endpoints), ['help'])], {
          stdout: 'pipe',
          stderr: 'pipe',
          signal: ctx.signal,
        });

        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);

        readWWWOutput('help', { exitCode, stdout, stderr });

        return null;
      },
    })
    .feature({
      name: 'notes',
      summary: 'Write rows with `www init`, a label, `set` and `done`, and read them in the brief',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'rows',
      summary: 'Read every open row and the whole history as JSON lines with `www rows`',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'hooks',
      summary:
        'Install the hooks into a temp home, and pipe hook payloads through `www hook` for each host',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'package',
      summary:
        'Build the binary for this machine, install it with install.sh, and run it as www and wherewerewe',
      paths: [
        'install.sh',
        'scripts/binaries/**',
        'packages/cli/src/cli.ts',
        'packages/cli/package.json',
      ],
    })
    .shared(
      'scripts/verify/**',
      'package.json',
      'bun.lock',
      'bunfig.toml',
      '.bun-version',
      'tsconfig.base.json',
    )
    .ignore(
      'docs/**',
      '**/*.md',
      '**/*.test.ts',
      '**/LICENSE',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.github/**',
      'scripts/dispatch-ship/**',
      'scripts/ship/**',
      'scripts/verify-gate/**',
      'scripts/run-knip.sh',
      '.editorconfig',
      '.git{ignore,leaksignore}',
      '.oxlintrc.json',
      '.release-please-manifest.json',
      'commitlint.config.js',
      'knip.json',
      'lefthook.yml',
      'oxfmt.config.ts',
      'release-please-config.json',
      'renovate.json',
      'review.json',
      'rig.config.ts',
      'socket.yml',
      'tsconfig.json',
    )
    .build();
}
