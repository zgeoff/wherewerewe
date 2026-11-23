import { expect, test } from 'bun:test';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { probeProcess } from './probe-process.ts';

test('it finds a running process and pid 1, and no exited process', async () => {
  const gone = await runGoneProcess();

  expect({
    running: probeProcess(process.pid),
    initProcess: probeProcess(1),
    gone: probeProcess(gone),
  }).toStrictEqual({ running: true, initProcess: true, gone: false });
});
