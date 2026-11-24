import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';

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
    root,
    runAsAgent: (argv: readonly string[]) =>
      run(argv, { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' }, false),
    runAsAgentWithPath: (argv: readonly string[], path: string) =>
      run(
        ['--session', 'tide-alerts', ...argv],
        { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: path },
        false,
      ),
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

test('it never rewrites owner.tsv in an agent write or a read, or in a refused init, import, install, doctor and hook', async () => {
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
    ['task', 't-p', 'Watch the process', '--pid', String(process.pid)],
    ['detach'],
    ['attach', 'tide-alerts'],
    [],
    ['show'],
    ['show', 'r-a'],
    ['log'],
    ['recap'],
    ['recap', '--since', '3d'],
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

test('it runs the probe of a write with a check before it takes the lock', async () => {
  const ctx = setupTest();
  const bin = join(ctx.root, 'bin');
  const marker = join(ctx.root, 'probed');
  const folder = join(ctx.root, 'wherewerewe', 'tide-alerts');

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);

  seedStubCommand(bin, 'gh', `echo ran > "${marker}"\nexit 1`);
  seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

  const result = await ctx.runAsAgentWithPath(
    ['task', 't-a', 'Write it', '--pr', 'bosunhq/bosun-api#1'],
    bin,
  );

  expect({
    exitCode: result.exitCode,
    probed: existsSync(marker),
    tasks: readFileSync(join(folder, 'items.tsv'), 'utf8').includes('t-a'),
  }).toStrictEqual({ exitCode: 3, probed: true, tasks: false });
});

test('it holds no lock while a probe runs, so a second write replies first and both land', async () => {
  const ctx = setupTest();
  const bin = join(ctx.root, 'bin');
  const started = join(ctx.root, 'probe-started');
  const folder = join(ctx.root, 'wherewerewe', 'tide-alerts');

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);

  seedStubCommand(
    bin,
    'gh',
    `echo started > "${started}"\n/bin/sleep 1\nprintf '%s' '{"state":"OPEN","statusCheckRollup":[]}'`,
  );

  const replies: string[] = [];

  const runTracked = async (name: string, argv: readonly string[]) => {
    const result = await ctx.runAsAgentWithPath(argv, bin);

    replies.push(name);

    return result;
  };

  const slow = runTracked('slow', ['task', 't-a', 'Write it', '--pr', 'bosunhq/bosun-api#1']);

  await waitFor(() => {
    expect(existsSync(started)).toBe(true);
  });

  const quick = await runTracked('quick', ['task', 't-b', 'Draw it']);
  const first = await slow;

  const written = readFileSync(join(folder, 'items.tsv'), 'utf8');

  expect({
    exitCodes: [quick.exitCode, first.exitCode],
    replies,
    both: [written.includes('t-a\ttask'), written.includes('t-b\ttask')],
  }).toStrictEqual({ exitCodes: [0, 0], replies: ['quick', 'slow'], both: [true, true] });
});
