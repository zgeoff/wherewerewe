import { expect, test } from 'bun:test';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { readProcessStart } from './read-process-start.ts';

test('it reads the same start for a running process each time, and null for an exited one', async () => {
  const gone = await runGoneProcess();

  expect({
    running: readProcessStart(process.pid),
    again: readProcessStart(process.pid),
    gone: readProcessStart(gone),
  }).toStrictEqual({
    running: expect.stringMatching(/^\d+$/u),
    again: readProcessStart(process.pid),
    gone: null,
  });
});
