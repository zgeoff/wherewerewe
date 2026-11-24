import { expect, onTestFinished, test } from 'bun:test';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
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

test('it runs the line against a copy of a run folder that holds a socket, and leaves the socket out', async () => {
  const ctx = setupTest();
  const folderFD = openSync(join(ctx.stateRoot, 'state'), 'r');

  onTestFinished(() => {
    closeSync(folderFD);
  });

  const server = createServer();

  // a socket path holds at most 107 bytes, which a temp folder's path can pass, so the socket is
  // made through the open folder
  await new Promise<void>((resolve) => {
    server.listen(`/proc/self/fd/${String(folderFD)}/supervisor.sock`, resolve);
  });

  onTestFinished(() => {
    server.close();
  });

  const seen: boolean[] = [];

  const output = await runWWWLineOnCopy(
    (argv) => {
      const stateHome = (argv.find((word) => word.startsWith('XDG_STATE_HOME=')) ?? '').slice(15);

      seen.push(existsSync(join(stateHome, 'supervisor.sock')));

      return Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
    },
    ctx.stateRoot,
    'www task t-a "Write it"',
  );

  expect({ output, copyHeldSocket: seen }).toStrictEqual({
    output: { exitCode: 0, stdout: 'ok', stderr: '' },
    copyHeldSocket: [false],
  });
});
