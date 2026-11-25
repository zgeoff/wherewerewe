import { expect, test } from 'bun:test';
import { buildCompileArgv } from './build-compile-argv.ts';

function setupTest() {
  return { buildCompileArgv };
}

test('it compiles the entry for one target with bytecode, ESM, and no .env or bunfig.toml loading', () => {
  const ctx = setupTest();

  expect(ctx.buildCompileArgv('linux-arm64', '/out')).toStrictEqual([
    'bun',
    'build',
    '--compile',
    '--bytecode',
    '--format=esm',
    '--no-compile-autoload-dotenv',
    '--no-compile-autoload-bunfig',
    '--target=bun-linux-arm64',
    'packages/cli/src/cli.ts',
    '--outfile',
    '/out/wherewerewe-linux-arm64',
  ]);
});
