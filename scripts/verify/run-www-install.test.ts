import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runWWWInstall } from './run-www-install.ts';

function setupTest() {
  const root = createTempDir('run-www-install').path;
  const calls: (readonly string[])[] = [];

  return {
    root,
    calls,
    run: () =>
      runWWWInstall((argv) => {
        calls.push(argv);

        return Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
      }, root),
  };
}

test('it puts a stub wherewerewe in the run bin folder and runs www install from the run home folder', async () => {
  const ctx = setupTest();

  const output = await ctx.run();

  expect({
    output,
    stub: readFileSync(join(ctx.root, 'bin', 'wherewerewe'), 'utf8'),
    isExecutable: statSync(join(ctx.root, 'bin', 'wherewerewe')).mode % 0o1000 === 0o755,
    shell: ctx.calls[0]?.slice(0, 5),
    tail: ctx.calls[0]?.slice(-1),
    hasHome: ctx.calls[0]?.includes(`HOME=${join(ctx.root, 'home')}`),
  }).toStrictEqual({
    output: { exitCode: 0, stdout: 'ok', stderr: '' },
    stub: 'binary-stub',
    isExecutable: true,
    shell: ['sh', '-c', String.raw`cd "$1" && shift && exec "$@"`, 'sh', join(ctx.root, 'home')],
    tail: ['install'],
    hasHome: true,
  });
});

test('it gives install a git that only prints a version, never the git of this machine', async () => {
  const ctx = setupTest();

  await ctx.run();

  expect({
    entries: readdirSync(join(ctx.root, 'bin')).toSorted(),
    git: readFileSync(join(ctx.root, 'bin', 'git'), 'utf8'),
  }).toStrictEqual({
    entries: ['git', 'wherewerewe'],
    git: '#!/bin/sh\necho "git version 2.50.0"\n',
  });
});

test('it unsets the agent config folders, so install writes only into the run home', async () => {
  const ctx = setupTest();

  await ctx.run();

  const argv = ctx.calls[0] ?? [];

  expect(['CLAUDE_CONFIG_DIR', 'CODEX_HOME'].map((name) => argv.indexOf(name) - 1)).toSatisfyAll(
    (at: number) => argv[at] === '-u',
  );
});
