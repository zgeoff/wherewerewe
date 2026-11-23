import { expect, test } from 'bun:test';
import { buildWWWArgv } from './build-www-argv.ts';

test('it runs www with the agent session variables unset and HOME and XDG_STATE_HOME inside the run folder', () => {
  const argv = buildWWWArgv('/runs/r-1', ['help']);

  expect(argv.slice(0, 12)).toStrictEqual([
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
    'bun',
  ]);

  expect(argv.at(-2)?.endsWith('packages/cli/src/cli.ts')).toBe(true);
  expect(argv.at(-1)).toBe('help');
});
