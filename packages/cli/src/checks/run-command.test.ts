import { expect, onTestFinished, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  const work = join(folder, 'work');

  mkdirSync(work);

  return {
    folder,
    work,
    run: (name: string, timeoutMs: number, env: Record<string, string> | null = null) =>
      runCommand([name, 'arg one'], {
        env: env ?? { PATH: folder },
        cwd: work,
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
    cwd: ctx.work,
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
await runCommand(['gh'], { env: { PATH: ${JSON.stringify(ctx.folder)} }, cwd: ${JSON.stringify(ctx.work)}, timeoutMs: 60000, kills: createKillSet() });`;

  const cli = Bun.spawn([process.execPath, '-e', program], {
    env: { PATH: ctx.folder },
    stdout: 'ignore',
    stderr: 'ignore',
  });

  onTestFinished(() => {
    cli.kill('SIGKILL');
  });

  await waitFor(() => {
    expect(existsSync(childPidFile)).toBe(true);
  });

  await waitFor(() => {
    expect(readFileSync(childPidFile, 'utf8')).toEndWith('\n');
  });

  const pids = [pidFile, childPidFile].map((file) => Number(readFileSync(file, 'utf8')));

  cli.kill('SIGTERM');

  await cli.exited;

  await waitFor(() => {
    expect(pids.map((pid) => readProcess(pid).kind)).toStrictEqual(['gone', 'gone']);
  });
});

test.each([
  {
    title: 'a relative PATH entry',
    entry: (folder: string) => relative(process.cwd(), join(folder, 'agent-bin')),
  },
  {
    title: 'a PATH entry inside the working folder',
    entry: (folder: string) => join(folder, 'work', 'agent-bin'),
  },
])('it never runs a git from $title, and runs the one after it', async (row) => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'agent-git-ran');
  const agentBin = row.entry(ctx.folder);
  const realBin = join(ctx.folder, 'real-bin');

  seedStubCommand(join(ctx.folder, 'agent-bin'), 'git', `: > "${marker}"; echo agent`);
  seedStubCommand(join(ctx.work, 'agent-bin'), 'git', `: > "${marker}"; echo agent`);
  seedStubCommand(realBin, 'git', 'echo real');

  const result = await ctx.run('git', 1000, { PATH: `${agentBin}:${realBin}` });

  expect({ result, ran: existsSync(marker) }).toStrictEqual({
    result: { kind: 'exit', code: 0, stdout: 'real\n', stderr: '' },
    ran: false,
  });
});

test('it never runs a git from a PATH entry that links into the working folder', async () => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'agent-git-ran');
  const link = join(ctx.folder, 'linked-bin');
  const realBin = join(ctx.folder, 'real-bin');

  seedStubCommand(join(ctx.work, 'agent-bin'), 'git', `: > "${marker}"; echo agent`);
  symlinkSync(join(ctx.work, 'agent-bin'), link);
  seedStubCommand(realBin, 'git', 'echo real');

  const result = await ctx.run('git', 1000, { PATH: `${link}:${realBin}` });

  expect({ result, ran: existsSync(marker) }).toStrictEqual({
    result: { kind: 'exit', code: 0, stdout: 'real\n', stderr: '' },
    ran: false,
  });
});

test('it gives the command only the variables git and gh need, the filtered PATH and the fixed probe settings', async () => {
  const ctx = setupTest();
  const realBin = join(ctx.folder, 'real-bin');

  // the stub's own shell adds PWD, SHLVL and _, so the stub leaves them out
  seedStubCommand(
    realBin,
    'git',
    String.raw`/usr/bin/env | /usr/bin/grep -v '^\(PWD\|SHLVL\|_\)=' | /usr/bin/sort`,
  );

  const result = await ctx.run('git', 1000, {
    PATH: `${join(ctx.work, 'agent-bin')}:${realBin}`,
    HOME: '/home/owner',
    GH_TOKEN: 'gh-token-value',
    GIT_CONFIG_GLOBAL: '/home/owner/.gitconfig',
    GIT_CONFIG_PARAMETERS: "'filter.x.clean'='touch ran'",
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG: '/dev/null',
    GIT_DIR: '/elsewhere/.git',
    GH_FORCE_TTY: '1',
    PAGER: 'less',
    LD_PRELOAD: '/work/evil.so',
    BASH_ENV: '/work/evil.sh',
    NODE_OPTIONS: '--require /work/evil.js',
  });

  expect(result).toStrictEqual({
    kind: 'exit',
    code: 0,
    stdout: [
      'GH_PROMPT_DISABLED=1',
      'GH_TOKEN=gh-token-value',
      'GIT_ALLOW_PROTOCOL=none',
      'GIT_CONFIG_GLOBAL=/home/owner/.gitconfig',
      'GIT_NO_LAZY_FETCH=1',
      'GIT_TERMINAL_PROMPT=0',
      'HOME=/home/owner',
      'LC_ALL=C',
      `PATH=${realBin}`,
      '',
    ].join('\n'),
    stderr: '',
  });
});
