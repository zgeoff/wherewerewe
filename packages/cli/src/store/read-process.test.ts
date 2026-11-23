import { expect, onTestFinished, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { waitFor } from '@zgeoff/testing';
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

// The shell's child exits while the shell, now sleep, never reaps it, so the child stays a zombie
// that a signal 0 still finds.
test('it reads a zombie as gone', async () => {
  const parent = Bun.spawn(['sh', '-c', 'sleep 0 & echo $!; exec sleep 5'], { stdout: 'pipe' });

  onTestFinished(() => {
    parent.kill();
  });

  const reader = parent.stdout.getReader();

  const chunk = await reader.read();

  const pid = Number(new TextDecoder().decode(chunk.value).trim());

  await waitFor(() => {
    expect(readFileSync(`/proc/${String(pid)}/stat`, 'utf8')).toInclude(') Z ');
  });

  expect(readProcess(pid)).toStrictEqual({ kind: 'gone' });
});
