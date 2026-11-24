import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { createKillSet, runCommand } from './run-command.ts';

function setupTest() {
  const folder = createTempDir('run-command').path;

  return {
    folder,
    run: (name: string, timeoutMs: number, env: Record<string, string> | null = null) =>
      runCommand([name, 'arg one'], {
        env: env ?? { PATH: folder },
        timeoutMs,
        kills: createKillSet(),
      }),
  };
}

test('it returns the exit code and what the command printed, with its arguments whole', async () => {
  const ctx = setupTest();

  seedStubCommand(ctx.folder, 'gh', 'echo "out $1"; echo "err" >&2; exit 3');

  const result = await ctx.run('gh', 1000);

  expect(result).toStrictEqual({ kind: 'exit', code: 3, stdout: 'out arg one\n', stderr: 'err\n' });
});

test('it reads a command that is not on the PATH of the env as missing', async () => {
  const ctx = setupTest();

  const result = await ctx.run('gh', 1000);

  expect(result).toStrictEqual({ kind: 'missing' });
});

test('it reads a command as missing when the env holds no PATH', async () => {
  const ctx = setupTest();

  const result = await ctx.run('sh', 1000, {});

  expect(result).toStrictEqual({ kind: 'missing' });
});

test('it never prompts: the command runs with stdin closed and both prompt variables set', async () => {
  const ctx = setupTest();

  seedStubCommand(
    ctx.folder,
    'git',
    'read line; echo "stdin:[$line] $GH_PROMPT_DISABLED $GIT_TERMINAL_PROMPT"',
  );

  const result = await ctx.run('git', 1000);

  expect(result).toStrictEqual({
    kind: 'exit',
    code: 0,
    stdout: 'stdin:[] 1 0\n',
    stderr: '',
  });
});

test('it kills a command that runs past its timeout, and the child it started', async () => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'child-ran-on');

  seedStubCommand(ctx.folder, 'gh', `/bin/sh -c '/bin/sleep 1; echo late > "${marker}"' &\nwait`);

  const result = await ctx.run('gh', 100);

  const children = Bun.spawnSync(['pgrep', '-f', marker]);

  expect([result, children.exitCode]).toStrictEqual([{ kind: 'timeout' }, 1]);
});
