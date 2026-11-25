import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runWWWHook } from './run-www-hook.ts';

function setupTest() {
  const root = createTempDir('run-www-hook').path;
  const calls: (readonly string[])[] = [];

  return {
    root,
    calls,
    exec: (argv: readonly string[]) => {
      calls.push(argv);

      return Promise.resolve({ exitCode: 0, stdout: 'GOAL line\nbrief "quoted"\n', stderr: '' });
    },
  };
}

test('it pipes the payload into www hook with the run folders, through a shell that holds the payload', async () => {
  const ctx = setupTest();

  const output = await runWWWHook(ctx.exec, ctx.root, 'claude', '{"cwd":"{run}"}');

  const [call] = ctx.calls;

  expect({
    output,
    shell: call?.slice(0, 3),
    payload: call?.[4],
    tail: call?.slice(-3),
    hasHome: call?.includes(`HOME=${join(ctx.root, 'home')}`),
  }).toStrictEqual({
    output: { exitCode: 0, stdout: 'GOAL line\nbrief "quoted"\n', stderr: '' },
    shell: ['sh', '-c', String.raw`payload=$1; shift; printf '%s' "$payload" | "$@"`],
    payload: `{"cwd":"${ctx.root}"}`,
    tail: [expect.stringContaining('cli.ts'), 'hook', 'claude'],
    hasHome: true,
  });
});

test('it puts the whole brief that www prints into the payload as the text of a JSON string', async () => {
  const ctx = setupTest();

  await runWWWHook(ctx.exec, ctx.root, 'codex', '{"tool_response":"{brief:trial-hooks}"}');

  const hook = ctx.calls.at(-1);
  const parsed = JSON.parse(String(hook?.[4]));

  expect({
    calls: ctx.calls.length,
    response: parsed.tool_response,
    briefTail: ctx.calls[0]?.slice(-2),
  }).toStrictEqual({
    calls: 2,
    response: 'GOAL line\nbrief "quoted"\n',
    briefTail: ['--session', 'trial-hooks'],
  });
});

test('it sets the host variable of the harness so the brief takes that host budget', async () => {
  const ctx = setupTest();

  await runWWWHook(ctx.exec, ctx.root, 'codex', '{}');

  expect(ctx.calls[0]?.includes('CODEX_SESSION_ID=verify-host')).toBe(true);
});
