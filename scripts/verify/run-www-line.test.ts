import { expect, test } from 'bun:test';
import { runWWWLine } from './run-www-line.ts';

test('it runs the parsed line through exec with the run folder, and returns what www printed', async () => {
  const calls: (readonly string[])[] = [];

  const output = await runWWWLine(
    (argv) => {
      calls.push(argv);

      return Promise.resolve({ exitCode: 3, stdout: 'out', stderr: 'err' });
    },
    '/runs/r-1',
    'www task t-a "Write it"',
  );

  expect(output).toStrictEqual({ exitCode: 3, stdout: 'out', stderr: 'err' });
  expect(calls.map((argv) => argv.slice(-3))).toStrictEqual([['task', 't-a', 'Write it']]);
  expect(calls.map((argv) => argv.includes('HOME=/runs/r-1/home'))).toStrictEqual([true]);
});
