import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import type { PullRequestRow } from '../types.ts';
import { checkLimits } from './check-limits.ts';
import { runChecks } from './run-checks.ts';

function setupTest() {
  const folder = createTempDir('run-checks').path;
  const clock = { nowMs: 1_000_000 };

  return {
    folder,
    passing: '{"state":"OPEN","statusCheckRollup":[]}',
    env: { PATH: folder },
    buildRow: (ref: string, state: PullRequestRow['state'] = null): PullRequestRow => ({
      ref,
      opened: '2026-03-10T08:41:30Z',
      state,
      seen: null,
    }),
    now: () => {
      clock.nowMs += 700;

      return clock.nowMs;
    },
  };
}

test('it probes each item with a check and each open row that no item names, and keys the results', async () => {
  const ctx = setupTest();

  seedStubCommand(ctx.folder, 'gh', `printf '%s' '${ctx.passing}'`);

  const run = await runChecks(
    ['pr-a', 'p-sim', 'bosunhq/bosun-app#64'],
    [
      buildMockItem({ id: 'pr-a', check: 'pr:bosunhq/bosun-api#77' }),
      buildMockItem({ id: 'p-sim', check: `pid:${String(process.pid)}` }),
      buildMockItem({ id: 't-plain' }),
    ],
    [ctx.buildRow('bosunhq/bosun-app#64', 'OPEN'), ctx.buildRow('bosunhq/bosun-api#77')],
    { deadlineMs: 2000, env: ctx.env, now: ctx.now },
  );

  expect(run).toStrictEqual({
    results: new Map([
      ['pr-a', 'OPEN no checks'],
      ['p-sim', 'alive'],
      ['bosunhq/bosun-app#64', 'OPEN no checks'],
    ]),
    ran: 3,
    unchecked: 0,
    reason: null,
    elapsedMs: 700,
  });
});

test('it never probes a row of prs.tsv that is merged or closed', async () => {
  const ctx = setupTest();

  seedStubCommand(ctx.folder, 'gh', `printf '%s' '${ctx.passing}'`);

  const run = await runChecks(
    [],
    [],
    [ctx.buildRow('bosunhq/bosun-app#1', 'MERGED'), ctx.buildRow('bosunhq/bosun-app#2', 'CLOSED')],
    { deadlineMs: 2000, env: ctx.env, now: ctx.now },
  );

  expect(run.ran).toBe(0);
});

test('it reads the clock only when a probe runs, and counts the ms from it', async () => {
  const ctx = setupTest();
  const calls: number[] = [];

  const run = await runChecks([], [buildMockItem({ id: 't-a' })], [], {
    deadlineMs: 2000,
    env: ctx.env,
    now: () => {
      calls.push(1);

      return 5;
    },
  });

  expect([run, calls]).toStrictEqual([
    { results: new Map(), ran: 0, unchecked: 0, reason: null, elapsedMs: 0 },
    [],
  ]);
});

test('it gives the one reason when every unchecked probe has it, and mixed when they differ', async () => {
  const ctx = setupTest();

  const items = [
    buildMockItem({ id: 'pr-a', check: 'pr:bosunhq/bosun-api#77' }),
    buildMockItem({ id: 'pr-b', check: 'pr:bosunhq/bosun-api#78' }),
    buildMockItem({ id: 'br-a', check: 'branch:/srv/nothing@main' }),
  ];

  const sameReason = await runChecks(['pr-a', 'pr-b'], items.slice(0, 2), [], {
    deadlineMs: 2000,
    env: ctx.env,
    now: ctx.now,
  });

  const mixed = await runChecks(['pr-a', 'pr-b', 'br-a'], items, [], {
    deadlineMs: 2000,
    env: ctx.env,
    now: ctx.now,
  });

  expect([
    [sameReason.unchecked, sameReason.reason],
    [mixed.unchecked, mixed.reason],
    mixed.results.get('br-a'),
  ]).toStrictEqual([[2, 'gh missing'], [3, 'mixed'], 'unchecked']);
});

test('it starts at most 8 probes at once, and runs the 9th when one ends', async () => {
  const ctx = setupTest();
  const log = join(ctx.folder, 'log');

  seedStubCommand(
    ctx.folder,
    'gh',
    `echo start >> "${log}"
i=0
while [ ! -e "${join(ctx.folder, 'release')}" ] && [ $i -lt 300 ]; do i=$((i+1)); /bin/sleep 0.02; done
printf '%s' '${ctx.passing}'`,
  );

  const items = Array.from({ length: 9 }, (_unused, index) =>
    buildMockItem({
      id: `pr-${String(index)}`,
      check: `pr:bosunhq/bosun-api#${String(index + 1)}`,
    }),
  );

  const running = runChecks(
    items.map((item) => item.id),
    items,
    [],
    { deadlineMs: checkLimits.deadlineMs, env: ctx.env, now: ctx.now },
  );

  const startedBeforeRelease = await waitFor(async () => {
    const text = await Bun.file(log).text();

    const lines = text.split('\n').filter(Boolean);

    if (lines.length < 8) {
      throw new Error('fewer than 8 probes have started');
    }

    return lines.length;
  });

  writeFileSync(join(ctx.folder, 'release'), '');

  const run = await running;

  expect([startedBeforeRelease, run.ran, run.unchecked]).toStrictEqual([8, 9, 0]);
});

test('it reads unchecked with timeout within the deadline for a gh that runs sleep 30, and leaves no child running', async () => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'child-ran-on');

  seedStubCommand(ctx.folder, 'gh', `/bin/sh -c '/bin/sleep 30; echo late > "${marker}"' &\nwait`);

  const startedAtMs = performance.now();

  const run = await runChecks(
    ['pr-a'],
    [buildMockItem({ id: 'pr-a', check: 'pr:bosunhq/bosun-api#77' })],
    [],
    { deadlineMs: 300, env: ctx.env, now: ctx.now },
  );

  const children = Bun.spawnSync(['pgrep', '-f', marker]);

  expect([
    run.results.get('pr-a'),
    run.reason,
    performance.now() - startedAtMs < 2000,
    children.exitCode,
  ]).toStrictEqual(['unchecked', 'timeout', true, 1]);
});

test('it starts probes in the order given, and a probe the deadline stops before it starts reads unchecked with timeout', async () => {
  const ctx = setupTest();
  const log = join(ctx.folder, 'log');

  seedStubCommand(
    ctx.folder,
    'gh',
    `/bin/sleep 0.$(printf '%02d' $(( (31 - $3) * 5 )))
echo "$3" >> "${log}"
/bin/sleep 5
printf '%s' '${ctx.passing}'`,
  );

  const items = Array.from({ length: 30 }, (_unused, index) =>
    buildMockItem({
      id: `t-${String(index + 1).padStart(2, '0')}`,
      check: `pr:bosunhq/bosun-api#${String(index + 1)}`,
    }),
  );

  const order = items.map((item) => item.id).toReversed();

  const run = await runChecks(order, items, [], { deadlineMs: 800, env: ctx.env, now: ctx.now });
  const logText = await Bun.file(log).text();

  // each probe logs after a delay that grows with its place in the order, so the log's own order
  // is the order the probes started in
  const started = logText.split('\n').filter(Boolean);

  expect([started, run.ran, run.unchecked, run.reason]).toStrictEqual([
    ['30', '29', '28', '27', '26', '25', '24', '23'],
    30,
    30,
    'timeout',
  ]);
});

test('it writes nothing in a repo: the files of .git hold the same hashes after two briefs that probe its branch, path, subfolder and file', async () => {
  const ctx = setupTest();
  const root = createTempDir('no-probe-writes').path;
  const bin = join(root, 'bin');

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  const repo = await seedGitRepo(root);

  mkdirSync(join(repo.folder, 'docks'));
  writeFileSync(join(repo.folder, 'docks', 'map.txt'), 'map\n');
  writeFileSync(join(repo.folder, 'scratch.txt'), 'dirty\n');

  const env = { HOME: root, XDG_STATE_HOME: root, CODEX_SESSION_ID: 'c9-test', PATH: bin };

  const run = (argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: root,
      terminal: { stdin: false, stdout: false },
      now: ctx.now,
    });

  await run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await run(['task', 't-branch', 'Push the branch', '--branch', `${repo.folder}@main`]);
  await run(['where', 'wt-repo', 'The work tree', '--path', repo.folder]);
  await run(['where', 'wt-docks', 'The docks folder', '--path', join(repo.folder, 'docks')]);
  await run(['where', 'wt-file', 'The map file', '--path', join(repo.folder, 'docks', 'map.txt')]);

  const before = await readTreeHashes(join(repo.folder, '.git'));

  await run([]);
  await run([]);

  const after = await readTreeHashes(join(repo.folder, '.git'));

  expect(Object.keys(before)).toContain('index');
  expect(after).toStrictEqual(before);
});

test('it runs no git fetch, pull, push, ls-remote or remote update in any probe', async () => {
  const root = createTempDir('probe-git-verbs').path;
  const bin = join(root, 'bin');
  const log = join(root, 'git-calls');

  const repo = await seedGitRepo(root);

  const realGit = Bun.which('git');

  mkdirSync(bin, { recursive: true });
  writeFileSync(log, '');
  seedStubCommand(bin, 'git', `echo "$*" >> "${log}"\nexec "${realGit}" "$@"`);

  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: bin };

  const run = (argv: readonly string[]) =>
    runCLI({ argv, env, cwd: '/work', terminal: { stdin: false, stdout: false }, now: () => 0 });

  await run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await run(['where', 'wt-a', 'A tree', '--path', repo.folder]);
  await run(['where', 'br-a', 'A branch', '--branch', `${repo.folder}@main`]);
  await run([]);
  await run(['show', 'br-a']);
  await run(['show', 'wt-a']);

  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter((line) => line !== '');

  const forbidden = calls.filter(
    (call) =>
      call.includes('remote update') ||
      call.split(' ').some((word) => ['fetch', 'pull', 'push', 'ls-remote'].includes(word)),
  );

  expect({ ran: calls.length > 0, forbidden }).toStrictEqual({ ran: true, forbidden: [] });
});
