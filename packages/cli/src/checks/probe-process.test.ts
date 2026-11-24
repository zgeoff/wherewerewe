import { expect, test } from 'bun:test';
import { readProcess } from '../store/read-process.ts';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { probeProcess } from './probe-process.ts';

test('it reads alive for the pid of the running test', () => {
  const probe = probeProcess({ pid: process.pid }, {});

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'alive' });
});

test('it reads gone for the pid of a process that has exited', async () => {
  const pid = await runGoneProcess();

  const probe = probeProcess({ pid }, {});

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'gone' });
});

test('it reads alive when the start time stored with the claim matches the one now', () => {
  const state = readProcess(process.pid);

  const probe = probeProcess(
    { pid: process.pid },
    { pid_start: state.kind === 'running' ? (state.start ?? '') : '' },
  );

  expect(probe.result).toStrictEqual({ kind: 'result', result: 'alive' });
});

test('it reads gone when the start time stored with the claim differs from the one now', () => {
  const state = readProcess(process.pid);
  const probe = probeProcess({ pid: process.pid }, { pid_start: '1' });

  expect([state.kind === 'running' && state.start !== null, probe.result]).toStrictEqual([
    true,
    { kind: 'result', result: 'gone' },
  ]);
});

test.each([[4_294_967_296], [2_147_483_648], [0], [-1], [1.5], [Number.NaN]])(
  'it reads gone for the pid %d, which names no process',
  (pid) => {
    const probe = probeProcess({ pid }, {});

    expect(probe.result).toStrictEqual({ kind: 'result', result: 'gone' });
  },
);
