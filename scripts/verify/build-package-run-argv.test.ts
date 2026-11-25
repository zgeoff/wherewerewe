import { expect, test } from 'bun:test';
import { buildPackageRunArgv } from './build-package-run-argv.ts';

function setupTest() {
  return { buildPackageRunArgv };
}

test('it runs the installed binary by name with the state inside the run and no agent session', () => {
  const ctx = setupTest();

  expect(ctx.buildPackageRunArgv('/runs/a', 'www', ['help'])).toStrictEqual([
    'env',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'WHEREWEREWE_SESSION',
    'HOME=/runs/a/home',
    'XDG_STATE_HOME=/runs/a/state',
    'PATH=/runs/a/bin',
    '/runs/a/bin/www',
    'help',
  ]);
});
