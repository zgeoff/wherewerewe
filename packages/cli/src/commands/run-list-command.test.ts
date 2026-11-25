import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { getJsonValue } from '../test-utils/get-json-value.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedGhAnswers } from '../test-utils/seed-gh-answers.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';

function setupTest() {
  const root = createTempDir('run-list').path;
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

test('it lists the saved result of each task in the text and the JSON, probes nothing and writes nothing', async () => {
  const ctx = setupTest();
  const marker = join(ctx.bin, 'probe-ran');

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'OPEN pending' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run([]);

  seedStubCommand(
    ctx.bin,
    'gh',
    `: > "${marker}"\nprintf '%s' '{"state":"MERGED","statusCheckRollup":[]}'`,
  );

  const before = await ctx.readTree();
  const text = await ctx.run(['list', 'tasks']);
  const json = await ctx.run(['list', 'tasks', '--json']);
  const after = await ctx.readTree();

  expect({
    tagged: text.stdout.includes('[OPEN pending]'),
    last: getJsonValue(JSON.parse(json.stdout), ['rows', 0, 'row', 'last']),
    probed: await Bun.file(marker).exists(),
    unchanged: after,
  }).toStrictEqual({ tagged: true, last: 'OPEN pending', probed: false, unchanged: before });
});
