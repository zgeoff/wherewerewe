import { expect, test } from 'bun:test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runWWWLine } from './run-www-line.ts';

test('it runs the parsed line through exec with the run folder, and returns what www printed', async () => {
  const root = createTempDir('run-www-line').path;
  const calls: (readonly string[])[] = [];

  const output = await runWWWLine(
    (argv) => {
      calls.push(argv);

      return Promise.resolve({ exitCode: 3, stdout: 'out', stderr: 'err' });
    },
    root,
    'www task t-a "Write it"',
  );

  expect(output).toStrictEqual({ exitCode: 3, stdout: 'out', stderr: 'err' });
  expect(calls.map((argv) => argv.slice(-3))).toStrictEqual([['task', 't-a', 'Write it']]);
  expect(calls.map((argv) => argv.includes(`HOME=${join(root, 'home')}`))).toStrictEqual([true]);
  expect(existsSync(join(root, 'bin', 'git'))).toBe(true);
});

test('it keeps a {run} path whole as one word when the run folder holds a space', async () => {
  const root = join(createTempDir('run-www-line-space').path, 'a b');
  const calls: (readonly string[])[] = [];

  mkdirSync(root);

  await runWWWLine(
    (argv) => {
      calls.push(argv);

      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    },
    root,
    'www where wt-a "tree" --path {run}/paths/dock',
  );

  expect(calls.map((argv) => argv.slice(-4))).toStrictEqual([
    ['wt-a', 'tree', '--path', `${root}/paths/dock`],
  ]);
});
