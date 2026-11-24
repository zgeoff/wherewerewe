import { expect, test } from 'bun:test';
import { buildTerminalWWWArgv } from './build-terminal-www-argv.ts';
import { cliPath } from './build-www-argv.ts';

test('it unsets the five agent variables and the session, then sets the given ones and runs www', () => {
  const argv = buildTerminalWWWArgv('/runs/r-1', ['--session', 'trial-owner', 'ack', 'o-1'], {
    CODEX_CI: '1',
  });

  expect(argv).toStrictEqual([
    'env',
    '-u',
    'CLAUDECODE',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'CODEX_CI',
    '-u',
    'WHEREWEREWE_SESSION',
    'CODEX_CI=1',
    'HOME=/runs/r-1/home',
    'XDG_STATE_HOME=/runs/r-1/state',
    'PATH=/runs/r-1/bin',
    process.execPath,
    cliPath,
    '--session',
    'trial-owner',
    'ack',
    'o-1',
  ]);
});
