import { expect, test } from 'bun:test';
import { buildWWWArgv } from './build-www-argv.ts';

test('it runs www with the agent session variables unset and HOME and XDG_STATE_HOME inside the run folder', () => {
  const argv = buildWWWArgv('/runs/r-1', ['help']);

  expect(argv.slice(0, 13)).toStrictEqual([
    'env',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'WHEREWEREWE_SESSION',
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
  const argv = buildWWWArgv('/runs/r-1', ['help'], row.host);

  expect(argv.slice(9, 12)).toStrictEqual([
    row.variable,
    'HOME=/runs/r-1/home',
    'XDG_STATE_HOME=/runs/r-1/state',
  ]);
});

test('it sets no agent session variable when no host is given', () => {
  const argv = buildWWWArgv('/runs/r-1', ['help']);

  expect(argv.filter((word) => word.includes('=verify-host'))).toStrictEqual([]);
});
