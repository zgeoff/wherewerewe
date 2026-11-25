import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runWWWInstall } from './run-www-install.ts';

test('it puts a stub wherewerewe in the run bin folder and runs www install from the run home folder', async () => {
  const root = createTempDir('run-www-install').path;
  const calls: (readonly string[])[] = [];

  const output = await runWWWInstall((argv) => {
    calls.push(argv);

    return Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
  }, root);

  expect({
    output,
    stub: readFileSync(join(root, 'bin', 'wherewerewe'), 'utf8'),
    isExecutable: statSync(join(root, 'bin', 'wherewerewe')).mode % 0o1000 === 0o755,
    entries: readdirSync(join(root, 'bin')).toSorted(),
    shell: calls[0]?.slice(0, 5),
    tail: calls[0]?.slice(-1),
    hasHome: calls[0]?.includes(`HOME=${join(root, 'home')}`),
  }).toStrictEqual({
    output: { exitCode: 0, stdout: 'ok', stderr: '' },
    stub: 'binary-stub',
    isExecutable: true,
    entries: ['git', 'wherewerewe'].filter((name) => name !== 'git' || Bun.which('git') !== null),
    shell: ['sh', '-c', String.raw`cd "$1" && shift && exec "$@"`, 'sh', join(root, 'home')],
    tail: ['install'],
    hasHome: true,
  });
});
