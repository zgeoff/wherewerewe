import { WringerError, createWringer, local } from '@wringer/core';
import type { Wringer } from '@wringer/core';
import { z } from 'zod';
import { buildWWWArgv } from './build-www-argv.ts';
import { readStateRoot } from './read-state-root.ts';
import { readWWWOutput } from './read-www-output.ts';

const wwwOutputSchema = z.strictObject({ exitCode: z.number().int(), firstLine: z.string() });

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

        const output = readWWWOutput('help', result);

        if (output.firstLine !== args.firstLine) {
          throw new WringerError('check-failed', {
            message: `www help printed ${JSON.stringify(output.firstLine)} as its first line, not ${JSON.stringify(args.firstLine)}`,
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
      '.gitignore',
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
