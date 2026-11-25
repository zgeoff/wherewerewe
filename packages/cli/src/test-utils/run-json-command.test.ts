import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { jsonVersion } from '../json/json-version.ts';
import { runCLI } from '../run-cli.ts';
import { runJsonCommand } from './run-json-command.ts';

function setupTest() {
  const root = createTempDir('run-json-command').path;

  return {
    env: { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    runJsonCommand,
  };
}

test('it runs a read with --json and parses the one line it prints', async () => {
  const ctx = setupTest();

  await runCLI({
    argv: ['init', 'tide-alerts', '--goal', 'Ship it'],
    env: ctx.env,
    cwd: '/work',
    terminal: { stdin: false, stdout: false },
    now: () => Date.parse('2026-03-10T11:43:00Z'),
  });

  const result = await ctx.runJsonCommand(ctx.env, ['log']);

  expect(result).toStrictEqual({
    exitCode: 0,
    lines: 1,
    stdout: expect.stringMatching(/^\{"v":1,"rows":\[.*\]\}\n$/u),
    value: { ...jsonVersion, rows: expect.any(Array) },
  });
});
