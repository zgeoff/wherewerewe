import { WringerError, createWringer, local } from '@wringer/core';
import type { Wringer } from '@wringer/core';
import { z } from 'zod';
import { buildWWWArgv } from './build-www-argv.ts';
import { checkWWWHelp } from './check-www-help.ts';
import { readStateRoot } from './read-state-root.ts';
import { readWWWOutput } from './read-www-output.ts';
import { runWWWLineOnCopy } from './run-www-line-on-copy.ts';
import { runWWWLine } from './run-www-line.ts';

const wwwOutputSchema = z.strictObject({ exitCode: z.number().int(), firstLine: z.string() });

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
      path: ['www', 'help'],
      summary: 'Run `www help`, and check that its first line is --first-line',
      effect: 'read',
      args: z.strictObject({ firstLine: z.string() }),
      data: wwwOutputSchema,
      run: async (args, ctx) => {
        const result = await ctx.exec(buildWWWArgv(readStateRoot(ctx.endpoints), ['help']));

        return checkWWWHelp(result, args.firstLine);
      },
    })
    .command({
      path: ['www', 'run'],
      summary: 'Run the `www` command line --line, and check that it exits 0 and prints --expect',
      args: z.strictObject({ line: z.string(), expect: z.string() }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await runWWWLine(ctx.exec, readStateRoot(ctx.endpoints), args.line);

        if (output.exitCode !== 0 || !output.stdout.includes(args.expect)) {
          throw new WringerError('check-failed', {
            message: `${args.line} exited ${String(output.exitCode)} and printed ${JSON.stringify(output.stdout + output.stderr)}, which lacks ${JSON.stringify(args.expect)}`,
          });
        }

        return output;
      },
    })
    .command({
      path: ['www', 'refuse'],
      summary:
        'Run --line on a copy of the run folder, and check that www refuses it with exit 3, --expect, and the line Run: --run',
      effect: 'read',
      args: z.strictObject({ line: z.string(), expect: z.string(), run: z.string() }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await runWWWLineOnCopy(ctx.exec, readStateRoot(ctx.endpoints), args.line);

        const isRefusal =
          output.exitCode === 3 &&
          output.stderr.includes(args.expect) &&
          output.stderr.split('\n').includes(`Run: ${args.run}`);

        if (!isRefusal) {
          throw new WringerError('check-failed', {
            message: `${args.line} exited ${String(output.exitCode)} with ${JSON.stringify(output.stderr)}`,
          });
        }

        return output;
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
      name: 'help',
      summary: 'Print the help text with `www help`',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'notes',
      summary:
        'Keep notes with `www init`, `task`, `set` and `done`, and read them back with `www`',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
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
      'scripts/dispatch-publish/**',
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
