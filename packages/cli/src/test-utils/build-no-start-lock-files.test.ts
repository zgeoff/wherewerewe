import { expect, test } from 'bun:test';
import { createLockFiles } from '../store/create-lock-files.ts';
import { buildNoStartLockFiles } from './build-no-start-lock-files.ts';
import { runGoneProcess } from './run-gone-process.ts';

test('it reads a running process with no start, and a gone one as gone', async () => {
  const files = buildNoStartLockFiles(createLockFiles());

  const gone = await runGoneProcess();

  expect({
    running: files.readProcess(process.pid),
    gone: files.readProcess(gone),
  }).toStrictEqual({ running: { kind: 'running', start: null }, gone: { kind: 'gone' } });
});
