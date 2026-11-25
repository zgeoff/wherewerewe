import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError, createWringer, local } from '@wringer/core';
import type { Wringer } from '@wringer/core';
import { terminal } from '@wringer/terminal';
import { z } from 'zod';
import { buildOwnerPrograms } from './build-owner-programs.ts';
import { buildWWWArgv } from './build-www-argv.ts';
import { checkWWWHelp } from './check-www-help.ts';
import { createFilterRepo } from './create-filter-repo.ts';
import { fillRunFolder } from './fill-run-folder.ts';
import { makePath } from './make-path.ts';
import { readStateRoot } from './read-state-root.ts';
import { readWWWOutput } from './read-www-output.ts';
import { removePath } from './remove-path.ts';
import { runWWWHook } from './run-www-hook.ts';
import { runWWWInstall } from './run-www-install.ts';
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
    .use(terminal({}))
    .target('local', {
      mode: 'launch',
      access: 'read-write',
      host: local(),
      launch: (ctx) => ({
        command: ['bun', '-e', "console.log('ready'); setInterval(() => {}, 1_000_000);"],
        ready: (line) => (line['message'] === 'ready' ? { stateRoot: ctx.runDirectory } : null),
      }),
      drivers: {
        terminal: (ctx) => ({ programs: buildOwnerPrograms(readStateRoot(ctx.endpoints)) }),
      },
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
        'Pipe the JSON --payload into `www hook <harness>` with the run home; {run} is the run folder and {brief:<name>} the whole brief of that session; check that it exits 0 and prints --expect, or nothing with --empty',
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
      path: ['www', 'install'],
      summary:
        'Run `www install` against the run home, and check that it exits 0 and prints --expect',
      args: z.strictObject({ expect: z.string() }),
      data: wwwRunSchema,
      run: async (args, ctx) => {
        const output = await runWWWInstall(ctx.exec, readStateRoot(ctx.endpoints));

        if (output.exitCode !== 0 || !output.stdout.includes(args.expect)) {
          throw new WringerError('check-failed', {
            message: `www install exited ${String(output.exitCode)} and printed ${JSON.stringify(output.stdout + output.stderr)}, which lacks ${JSON.stringify(args.expect)}`,
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
    .command({
      path: ['www', 'make-path'],
      summary: 'Make the folder <run>/paths/<name> for a --path check; usage when it exists',
      args: z.strictObject({ name: z.string() }),
      data: z.strictObject({ folder: z.string() }),
      run: (args, ctx) =>
        Promise.resolve({ folder: makePath(readStateRoot(ctx.endpoints), args.name) }),
    })
    .command({
      path: ['www', 'make-filter-repo'],
      summary:
        'Make <run>/paths/<name> a git repo whose own filter creates <run>/paths/<name>-ran when it runs',
      args: z.strictObject({ name: z.string() }),
      data: z.strictObject({ folder: z.string() }),
      run: (args, ctx) =>
        Promise.resolve({ folder: createFilterRepo(readStateRoot(ctx.endpoints), args.name) }),
    })
    .command({
      path: ['www', 'expect-missing'],
      summary: 'Check that --path does not exist; {run} in it is the run folder',
      args: z.strictObject({ path: z.string() }),
      data: z.strictObject({ path: z.string() }),
      run: (args, ctx) => {
        const path = fillRunFolder(args.path, readStateRoot(ctx.endpoints));

        if (existsSync(path)) {
          return Promise.reject(new WringerError('check-failed', { message: `${path} exists` }));
        }

        return Promise.resolve({ path });
      },
    })
    .command({
      path: ['www', 'remove-path'],
      summary: 'Remove the folder <run>/paths/<name>; usage when it is missing',
      args: z.strictObject({ name: z.string() }),
      data: z.strictObject({ folder: z.string() }),
      run: (args, ctx) =>
        Promise.resolve({ folder: removePath(readStateRoot(ctx.endpoints), args.name) }),
    })
    .command({
      path: ['www', 'seed-hand-kept'],
      summary: 'Copy the invented hand-kept store into the run as session trial-import',
      args: z.strictObject({}),
      data: z.strictObject({ folder: z.string() }),
      run: (_args, ctx) => {
        const folder = join(readStateRoot(ctx.endpoints), 'state', 'wherewerewe', 'trial-import');

        if (existsSync(folder)) {
          return Promise.reject(
            new WringerError('usage', {
              message: 'trial-import exists in this run. Run `bun verify up --restart` first.',
            }),
          );
        }

        cpSync(join(import.meta.dir, 'fixtures', 'hand-kept-store'), folder, { recursive: true });

        return Promise.resolve({ folder });
      },
    })
    .command({
      path: ['www', 'seed-format-1'],
      summary: 'Copy the invented format 1 store into the run as session trial-grant',
      args: z.strictObject({}),
      data: z.strictObject({ folder: z.string() }),
      run: (_args, ctx) => {
        const folder = join(readStateRoot(ctx.endpoints), 'state', 'wherewerewe', 'trial-grant');

        if (existsSync(folder)) {
          return Promise.reject(
            new WringerError('usage', {
              message: 'trial-grant exists in this run. Run `bun verify up --restart` first.',
            }),
          );
        }

        cpSync(join(import.meta.dir, 'fixtures', 'format-1-store'), folder, { recursive: true });

        return Promise.resolve({ folder });
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
    .feature({
      name: 'import',
      summary: 'Convert a hand-kept store with `www import`, and read its brief',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'owner-notes',
      summary:
        'Write and clear owner notes with `www say` and `www ack` in a terminal, and read them in the brief',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'item-notes',
      summary:
        'Keep a note on an item with `--note` and `--owed`, read it under `NOW`, and clear an owed note before a close',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'grant',
      summary:
        "Upgrade a format 1 store to format 2 with the owner's words as its grant, and read and replace the grant",
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'recap',
      summary:
        'Read one screen of what a session kept with `www recap`, and run the command of one of its overflow lines',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'tasks',
      summary:
        'Open 20 tasks, read them in the brief under each host, and list every open task with `www show`',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'checks',
      summary:
        'Write an item with a --path check, remove the path, read the CHANGED row, and run the fix command it prints',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'new-kinds',
      summary:
        "Write a lesson, a promise and the owner's words, read them in the brief and the recap, list the rules, and close each",
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'json',
      summary: 'Read the brief and a list as JSON, and print the grant as a /goal text',
      paths: ['packages/cli/src/**', 'packages/cli/package.json', 'packages/cli/tsconfig.json'],
    })
    .feature({
      name: 'hooks',
      summary:
        'Pipe hook payloads through www hook for each host, and install the hooks into a temp home',
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
