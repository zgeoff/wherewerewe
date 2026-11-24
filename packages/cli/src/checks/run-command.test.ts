import { expect, onTestFinished, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runGit } from '@zgeoff/testing/git';
import { readProcess } from '../store/read-process.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
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

test('it never prompts: the command runs with stdin closed, both prompt variables set and no git transport allowed', async () => {
  const ctx = setupTest();

  seedStubCommand(
    ctx.folder,
    'git',
    'read line; echo "stdin:[$line] $GH_PROMPT_DISABLED $GIT_TERMINAL_PROMPT $GIT_ALLOW_PROTOCOL"',
  );

  const result = await ctx.run('git', 1000);

  expect(result).toStrictEqual({
    kind: 'exit',
    code: 0,
    stdout: 'stdin:[] 1 0 none\n',
    stderr: '',
  });
});

test('it fetches no missing object into a partial clone while git reads its status', async () => {
  const ctx = setupTest();

  const source = await seedGitRepo(ctx.folder);

  const clone = join(ctx.folder, 'partial');

  linkCommands(ctx.folder, ['git']);

  await runGit(source.remote, source.env, ['config', 'uploadpack.allowFilter', 'true']);

  await runGit(ctx.folder, source.env, [
    'clone',
    '--quiet',
    '--no-checkout',
    '--filter=blob:none',
    `file://${source.remote}`,
    clone,
  ]);

  await runGit(clone, source.env, ['read-tree', 'HEAD']);
  await runGit(clone, source.env, ['rm', '--quiet', '--cached', 'kiln.txt']);

  writeFileSync(join(clone, 'dock.txt'), 'first\nsecond\n');

  await runGit(clone, source.env, ['add', 'dock.txt']);

  const before = await readTreeHashes(join(clone, '.git'));

  await runCommand(['git', '--no-optional-locks', '-C', clone, 'status', '--porcelain'], {
    env: { PATH: ctx.folder },
    timeoutMs: 5000,
    kills: createKillSet(),
  });

  const after = await readTreeHashes(join(clone, '.git'));

  expect(after).toStrictEqual(before);
});

test('it kills a command that runs past its timeout, and the child it started', async () => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'child-ran-on');

  seedStubCommand(ctx.folder, 'gh', `/bin/sh -c '/bin/sleep 1; echo late > "${marker}"' &\nwait`);

  const result = await ctx.run('gh', 100);

  const children = Bun.spawnSync(['pgrep', '-f', marker]);

  expect([result, children.exitCode]).toStrictEqual([{ kind: 'timeout' }, 1]);
});

test('it kills a running command and its child when the process is interrupted', async () => {
  const ctx = setupTest();
  const pidFile = join(ctx.folder, 'stub-pid');
  const childPidFile = join(ctx.folder, 'child-pid');

  seedStubCommand(
    ctx.folder,
    'gh',
    `echo $$ > "${pidFile}"\n/bin/sleep 30 &\necho $! > "${childPidFile}"\nwait`,
  );

  const program = `import { createKillSet, runCommand } from ${JSON.stringify(join(import.meta.dir, 'run-command.ts'))};
await runCommand(['gh'], { env: { PATH: ${JSON.stringify(ctx.folder)} }, timeoutMs: 60000, kills: createKillSet() });`;

  const cli = Bun.spawn([process.execPath, '-e', program], {
    env: { PATH: ctx.folder },
    stdout: 'ignore',
    stderr: 'ignore',
  });

  onTestFinished(() => {
    cli.kill('SIGKILL');
  });

  await waitFor(() => expect(existsSync(childPidFile)).toBe(true));
  await waitFor(() => expect(readFileSync(childPidFile, 'utf8')).toEndWith('\n'));

  const pids = [pidFile, childPidFile].map((file) => Number(readFileSync(file, 'utf8')));

  cli.kill('SIGTERM');

  await cli.exited;

  await waitFor(() => {
    expect(pids.map((pid) => readProcess(pid).kind)).toStrictEqual(['gone', 'gone']);
  });
});
