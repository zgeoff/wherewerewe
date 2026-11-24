import { expect, test } from 'bun:test';
import { chmodSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';

function setupTest() {
  const root = createTempDir('run-write').path;
  const ownerPath = join(root, 'wherewerewe', 'tide-alerts', 'owner.tsv');
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  const run = (argv: readonly string[], env: Record<string, string>, isTerminal: boolean) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: isTerminal, stdout: isTerminal },
      now: () => {
        clock.nowMs += 1000;

        return clock.nowMs - 1000;
      },
    });

  return {
    runAsAgent: (argv: readonly string[]) =>
      run(argv, { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' }, false),
    runAsOwner: (argv: readonly string[]) => run(argv, { HOME: root, XDG_STATE_HOME: root }, true),
    lockOwnerFile: () => {
      chmodSync(ownerPath, 0o444);
    },
    readOwnerFile: () => {
      const stats = statSync(ownerPath);

      return { ino: stats.ino, mode: stats.mode & 0o777, text: readFileSync(ownerPath, 'utf8') };
    },
  };
}

test('it never rewrites owner.tsv in an agent write or a read', async () => {
  const ctx = setupTest();

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);
  await ctx.runAsOwner(['--session', 'tide-alerts', 'say', 'Ask me first']);

  ctx.lockOwnerFile();

  const untouched = ctx.readOwnerFile();

  const accepted = [
    ['goal', 'Ship the glaze timer and its tests'],
    ['task', 't-a', 'Write it'],
    ['now', 't-a', 'Start with the parser'],
    ['wait', 'w-a', 'Answer from the vendor', '--who', 'vendor'],
    [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'the timer repo',
      '--once',
    ],
    ['rule', 'r-a', 'Run the tests from the repo root'],
    ['where', 'wt-a', 'A worktree for the timer'],
    ['set', 't-a', 'Write it with tests'],
    ['task', 't-b', 'Fire the test tiles', '--note', '<a note>', '--owed'],
    ['now', 't-b', 'Load the kiln', '--note', '<a note>'],
    ['set', 't-b', '--note', '<a note>'],
    ['set', 't-b', '--no-note'],
    ['set', 't-b', 'Fire the test tiles at cone 6', '--note', '<a note>'],
    ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'],
    ['decide', 'Poll every minute', '--why', 'Too slow', '--ruled-out'],
    ['use', 'ok-a', '--for', 'merged the timer'],
    ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
    ['drop', 'w-a', '--why', 'the vendor answered in chat'],
    ['detach'],
    ['attach', 'tide-alerts'],
    [],
    ['show', 'r-a'],
    ['log'],
  ];

  const refused = [
    { argv: ['init', 'tide-alerts', '--goal', 'Ship the glaze timer'], exitCode: 3 },
    { argv: ['import', 'tide-alerts'], exitCode: 3 },
    { argv: ['install'], exitCode: 2 },
    { argv: ['doctor'], exitCode: 2 },
    { argv: ['hook', 'claude'], exitCode: 2 },
  ];

  const runs = [...accepted.map((argv) => ({ argv, exitCode: 0 })), ...refused];
  const exitCodes: number[] = [];
  const owners: unknown[] = [];

  for (const run of runs) {
    const result = await ctx.runAsAgent(['--session', 'tide-alerts', ...run.argv]);

    exitCodes.push(result.exitCode);
    owners.push(ctx.readOwnerFile());
  }

  expect({ exitCodes, owners }).toStrictEqual({
    exitCodes: runs.map((run) => run.exitCode),
    owners: runs.map(() => untouched),
  });
});
