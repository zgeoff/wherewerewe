import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readHostReaches } from './read-host-reaches.ts';

function setupTest() {
  const root = createTempDir('host-reaches').path;

  mkdirSync(join(root, 'packages', 'cli', 'src'), { recursive: true });
  mkdirSync(join(root, 'scripts', 'verify'), { recursive: true });

  return { root, repoRoot: join(import.meta.dir, '..', '..', '..', '..'), readHostReaches };
}

test('it finds no test in the repo that runs the real gh or git or reaches the network', () => {
  const ctx = setupTest();

  expect(ctx.readHostReaches(ctx.repoRoot)).toStrictEqual([]);
});

test('it reports a command run by an absolute path to gh or git', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'src', 'a.test.ts'),
    [
      "const a = Bun.spawn(['/usr/bin/git', 'status']);",
      "const b = run('/opt/homebrew/bin/gh pr list');",
      "const c = seedStubCommand(bin, 'gh', 'exec /usr/local/bin/gh \"$@\"');",
      "const d = Bun.spawn({ cmd: ['/usr/bin/git', 'status'] });",
      "const e = run('GIT_DIR=dock /usr/bin/git status');",
      "const fine = Bun.spawn(['git', 'status']);",
      "const alsoFine = '/work/github/notes.txt';",
      '',
    ].join('\n'),
  );

  expect(ctx.readHostReaches(ctx.root).toSorted()).toStrictEqual([
    'packages/cli/src/a.test.ts:1',
    'packages/cli/src/a.test.ts:2',
    'packages/cli/src/a.test.ts:3',
    'packages/cli/src/a.test.ts:4',
    'packages/cli/src/a.test.ts:5',
  ]);
});

test('it reports a git command that clones, fetches, pulls, pushes or lists a remote', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'src', 'a.test.ts'),
    [
      "const a = Bun.spawn(['git', 'clone', url]);",
      "const b = Bun.spawn(['git', '-C', folder, 'fetch', 'origin']);",
      "const c = run('git pull --ff-only');",
      'const d = run(`echo ready',
      '  git -C dock push origin main`);',
      "const e = Bun.spawn(['git', '--no-pager', 'ls-remote', url]);",
      "const f = run('git -c core.pager=cat fetch origin');",
      "await runGit(folder, env, ['fetch', 'origin']);",
      "await runGit(folder, env, ['-C', 'dock', 'pull']);",
      "await runGit(folder, env, ['push', '--set-upstream', 'origin', 'main']);",
      "const fine = Bun.spawn(['git', '-C', folder, 'status', '--porcelain']);",
      "const alsoFine = Bun.spawn(['git', 'log', '--grep', 'fetch']);",
      "const title = 'it runs no git fetch in any probe';",
      "const words = ['fetch', 'pull', 'push'];",
      "await runGit(folder, env, ['status']);",
      "expect(words).toStrictEqual(['fetch', 'pull', 'push']);",
      '',
    ].join('\n'),
  );

  expect(ctx.readHostReaches(ctx.root)).toStrictEqual([
    'packages/cli/src/a.test.ts:1',
    'packages/cli/src/a.test.ts:2',
    'packages/cli/src/a.test.ts:3',
    'packages/cli/src/a.test.ts:4',
    'packages/cli/src/a.test.ts:6',
    'packages/cli/src/a.test.ts:7',
    'packages/cli/src/a.test.ts:8',
    'packages/cli/src/a.test.ts:9',
    'packages/cli/src/a.test.ts:10',
  ]);
});

test('it reports a socket or an HTTP call, in a script test as well as a package test', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'src', 'a.test.ts'),
    [
      "import { connect } from 'node:net';",
      "import { request } from 'node:https';",
      "const a = await fetch('http://dock.test/map');",
      'const b = await globalThis.fetch(url);',
      'const c = Bun.connect({ unix: sock });',
      'const d = new WebSocket(url);',
      "import 'http';",
      "const e = await runGit(folder, env, ['remote', 'add', 'origin', 'https://dock.test/map.git']);",
      'const fine = stub.fetch(url);',
      "const alsoFine = 'fetch(url)';",
      "const url = 'https://dock.test/map';",
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(ctx.root, 'scripts', 'verify', 'b.test.ts'),
    "import { get } from 'node:http';\n",
  );

  expect(ctx.readHostReaches(ctx.root).toSorted()).toStrictEqual([
    'packages/cli/src/a.test.ts:1',
    'packages/cli/src/a.test.ts:2',
    'packages/cli/src/a.test.ts:3',
    'packages/cli/src/a.test.ts:4',
    'packages/cli/src/a.test.ts:5',
    'packages/cli/src/a.test.ts:6',
    'packages/cli/src/a.test.ts:7',
    'packages/cli/src/a.test.ts:8',
    'scripts/verify/b.test.ts:1',
  ]);
});

test('it reads a test file only, and skips node_modules', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.root, 'packages', 'cli', 'node_modules', 'dock'), { recursive: true });
  writeFileSync(join(ctx.root, 'packages', 'cli', 'src', 'a.ts'), "import 'node:net';\n");

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'node_modules', 'dock', 'a.test.ts'),
    "import 'node:net';\n",
  );

  expect(ctx.readHostReaches(ctx.root)).toStrictEqual([]);
});

test('it exempts only the one kind of reach that a named file needs, and reports every other kind there', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.root, 'packages', 'cli', 'src', 'checks'), { recursive: true });

  writeFileSync(
    join(ctx.root, 'scripts', 'verify', 'run-www-line-on-copy.test.ts'),
    [
      "import { createServer } from 'node:net';",
      "const a = await fetch('http://dock.test/map');",
      "const b = run('git fetch origin');",
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'src', 'run-www-line-on-copy.test.ts'),
    "import { createServer } from 'node:net';\n",
  );

  writeFileSync(
    join(ctx.root, 'packages', 'cli', 'src', 'checks', 'probe-branch.test.ts'),
    [
      "await runGit(folder, env, ['push', '--quiet', 'origin', 'main']);",
      "await runGit(folder, env, ['remote', 'add', 'origin', 'https://dock.test/map.git']);",
      "const a = run('git fetch origin');",
      '',
    ].join('\n'),
  );

  expect(ctx.readHostReaches(ctx.root).toSorted()).toStrictEqual([
    'packages/cli/src/checks/probe-branch.test.ts:2',
    'packages/cli/src/checks/probe-branch.test.ts:3',
    'packages/cli/src/run-www-line-on-copy.test.ts:1',
    'scripts/verify/run-www-line-on-copy.test.ts:2',
    'scripts/verify/run-www-line-on-copy.test.ts:3',
  ]);
});

test('it reads the test files of every folder of the repo and of its root, and skips node_modules and worktrees', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.root, '.agents', 'tools'), { recursive: true });
  mkdirSync(join(ctx.root, 'node_modules', 'dock'), { recursive: true });
  mkdirSync(join(ctx.root, '.worktrees', 'other'), { recursive: true });
  writeFileSync(join(ctx.root, 'root.test.ts'), "import 'node:net';\n");
  writeFileSync(join(ctx.root, '.agents', 'tools', 'a.test.ts'), "import 'node:net';\n");
  writeFileSync(join(ctx.root, 'node_modules', 'dock', 'a.test.ts'), "import 'node:net';\n");
  writeFileSync(join(ctx.root, '.worktrees', 'other', 'a.test.ts'), "import 'node:net';\n");

  expect(ctx.readHostReaches(ctx.root).toSorted()).toStrictEqual([
    '.agents/tools/a.test.ts:1',
    'root.test.ts:1',
  ]);
});
