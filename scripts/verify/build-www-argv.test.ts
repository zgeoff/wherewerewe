import { expect, test } from 'bun:test';
import { buildWWWArgv } from './build-www-argv.ts';

function setupTest() {
  return { build: buildWWWArgv };
}

test('it runs www in <run>/cwd with the agent variables unset and HOME and XDG_STATE_HOME inside the run folder', () => {
  const ctx = setupTest();
  const argv = ctx.build('/runs/r-1', ['help']);

  expect(argv.slice(0, 21)).toStrictEqual([
    '/bin/sh',
    '-c',
    'mkdir -p "$0" && cd "$0" && exec "$@"',
    '/runs/r-1/cwd',
    'env',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'WHEREWEREWE_SESSION',
    '-u',
    'CLAUDE_CONFIG_DIR',
    '-u',
    'CODEX_HOME',
    'HOME=/runs/r-1/home',
    'XDG_STATE_HOME=/runs/r-1/state',
    'PATH=/runs/r-1/bin',
    process.execPath,
  ]);

  expect(argv.at(-2)?.endsWith('packages/cli/src/cli.ts')).toBe(true);
  expect(argv.at(-1)).toBe('help');
});

test.each([
  { host: 'claude', variable: 'CLAUDE_CODE_SESSION_ID=verify-host' },
  { host: 'codex', variable: 'CODEX_SESSION_ID=verify-host' },
] as const)('it sets the session variable of the $host host after the unset words', (row) => {
  const ctx = setupTest();
  const argv = ctx.build('/runs/r-1', ['help'], row.host);

  expect(argv.slice(17, 20)).toStrictEqual([
    row.variable,
    'HOME=/runs/r-1/home',
    'XDG_STATE_HOME=/runs/r-1/state',
  ]);
});

test('it sets no agent session variable when no host is given', () => {
  const ctx = setupTest();
  const argv = ctx.build('/runs/r-1', ['help']);

  expect(argv.filter((word) => word.includes('=verify-host'))).toStrictEqual([]);
});
