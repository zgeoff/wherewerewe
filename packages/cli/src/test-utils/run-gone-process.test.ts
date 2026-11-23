import { expect, test } from 'bun:test';
import { runGoneProcess } from './run-gone-process.ts';

test('it gives the pid of a process that has exited', async () => {
  const pid = await runGoneProcess();

  expect(() => process.kill(pid, 0)).toThrow();
});
