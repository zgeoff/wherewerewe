import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runWWWLineOnCopy } from './run-www-line-on-copy.ts';

function setupTest() {
  const stateRoot = createTempDir('www-line-on-copy').path;
  const notePath = join(stateRoot, 'state', 'note');

  mkdirSync(join(stateRoot, 'state'));
  writeFileSync(notePath, 'before');

  return { stateRoot, notePath };
}

test('it runs the line against a copy of the run folder, and leaves the run folder as it was', async () => {
  const ctx = setupTest();
  const seen: string[] = [];

  const output = await runWWWLineOnCopy(
    (argv) => {
      const stateHome = (argv.find((word) => word.startsWith('XDG_STATE_HOME=')) ?? '').slice(15);

      seen.push(readFileSync(join(stateHome, 'note'), 'utf8'));

      writeFileSync(join(stateHome, 'note'), 'after');

      return Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
    },
    ctx.stateRoot,
    'www task t-a "Write it"',
  );

  expect({
    output,
    copySawBefore: seen,
    runFolderNote: readFileSync(ctx.notePath, 'utf8'),
  }).toStrictEqual({
    output: { exitCode: 0, stdout: 'ok', stderr: '' },
    copySawBefore: ['before'],
    runFolderNote: 'before',
  });
});
