import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedGhAnswers } from '../test-utils/seed-gh-answers.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';

function setupTest() {
  const root = createTempDir('run-show').path;
  const bin = join(root, 'bin');
  const stateRoot = join(root, 'wherewerewe');
  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: bin };

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  return {
    bin,
    run: (argv: readonly string[]) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => Date.parse('2026-03-10T11:43:00Z'),
      }),
    readTree: () => readTreeHashes(stateRoot),
  };
}

test('it probes the check of the item and prints OPEN failing with the names of the failing checks, and saves nothing', async () => {
  const ctx = setupTest();

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'OPEN pending' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);

  seedStubCommand(
    ctx.bin,
    'gh',
    `printf '%s' '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"FAILURE"},{"name":"e2e","status":"COMPLETED","conclusion":"TIMED_OUT"},{"name":"unit","status":"COMPLETED","conclusion":"SUCCESS"}]}'`,
  );

  const before = await ctx.readTree();
  const shown = await ctx.run(['show', 'pr-api-77']);
  const after = await ctx.readTree();

  expect({
    exitCode: shown.exitCode,
    line: shown.stdout.split('\n').find((line) => line.startsWith('  checked now')),
    unchanged: after,
  }).toStrictEqual({
    exitCode: 0,
    line: '  checked now: OPEN failing (lint, e2e) · at write: OPEN pending',
    unchanged: before,
  });
});

test('it prints unchecked now when no gh answers, and probes nothing for an item with no check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run(['task', 't-plain', 'No check']);

  const checked = await ctx.run(['show', 'pr-api-77']);
  const plain = await ctx.run(['show', 't-plain']);

  expect([
    checked.stdout.split('\n').find((line) => line.startsWith('  checked now')),
    plain.stdout.includes('checked now'),
  ]).toStrictEqual(['  checked now: unchecked · at write: not checked yet', false]);
});

test('it cuts the line of a failing check name of 300 characters to 100 characters', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);

  seedStubCommand(
    ctx.bin,
    'gh',
    `printf '%s' '{"state":"OPEN","statusCheckRollup":[{"name":"${'n'.repeat(300)}","status":"COMPLETED","conclusion":"FAILURE"}]}'`,
  );

  const shown = await ctx.run(['show', 'pr-api-77']);

  const row = shown.stdout.split('\n').find((line) => line.startsWith('  checked now')) ?? '';

  expect([[...row].length, row.endsWith('…')]).toStrictEqual([100, true]);
});

test('it lists every open task with its saved result and probes nothing', async () => {
  const ctx = setupTest();
  const marker = join(ctx.bin, 'ran');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);

  seedStubCommand(ctx.bin, 'gh', `echo ran > "${marker}"\nexit 1`);

  const listed = await ctx.run(['show']);

  expect([listed.stdout.includes('pr-api-77'), await Bun.file(marker).exists()]).toStrictEqual([
    true,
    false,
  ]);
});
