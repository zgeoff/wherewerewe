import { expect, test } from 'bun:test';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { readProcess } from './read-process.ts';

test('it reads the same start for a running process each time, and gone for an exited one', async () => {
  const gone = await runGoneProcess();

  expect({
    running: readProcess(process.pid),
    again: readProcess(process.pid),
    gone: readProcess(gone),
  }).toStrictEqual({
    running: { kind: 'running', start: expect.stringMatching(/^\d+$/u) },
    again: readProcess(process.pid),
    gone: { kind: 'gone' },
  });
});

test('it reads pid 1 as running', () => {
  expect(readProcess(1)).toStrictEqual({ kind: 'running', start: expect.any(String) });
});
