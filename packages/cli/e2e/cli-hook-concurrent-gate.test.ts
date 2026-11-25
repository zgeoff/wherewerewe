import { expect, test } from 'bun:test';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { run, start } from '@zgeoff/testing/process';
import { buildHookPayload } from '../src/test-utils/build-hook-payload.ts';
import { readGateLine } from '../src/test-utils/read-gate-line.ts';
import { seedHookStore } from '../src/test-utils/seed-hook-store.ts';

async function setupTest() {
  // the smoke job names a compiled binary, so the gate lock is proven on each platform's own runner
  const resolved = await resolveProgram('www');

  const program = {
    ...resolved,
    command: [process.env['WHEREWEREWE_BIN'] || resolved.command].flat(),
  };

  const stateHome = createTempDir('hook-concurrent').path;
  const root = join(stateHome, 'wherewerewe');

  const env = {
    XDG_STATE_HOME: stateHome,
    HOME: stateHome,
    CLAUDE_CODE_SESSION_ID: '',
    CODEX_SESSION_ID: '',
    CODEX_THREAD_ID: '',
    WHEREWEREWE_SESSION: '',
  };

  await seedHookStore(root, { harness: 'claude', id: '9e1f-trial' }, 'tide-alerts');

  const sessionStart = buildHookPayload('claude', '9e1f-trial', { event: 'SessionStart' });

  const brief = buildHookPayload('claude', '9e1f-trial', {
    event: 'PreToolUse',
    command: 'www',
  });

  return {
    root,
    sessionStart,
    brief,
    gate: () => readGateLine(root, 'claude-9e1f-trial'),
    send: (text: string) =>
      run(program.command, {
        cwd: program.cwd,
        env,
        args: ['hook', 'claude'],
        input: text,
      }),
    startHolder: async (text: string) => {
      const handle = await start(program.command, {
        cwd: program.cwd,
        env,
        args: ['hook', 'claude'],
      });

      await handle.write(text);

      return handle;
    },
    holdFault: () => {
      writeFileSync(join(root, 'hook-fault'), 'hold\n');
    },
    clearFault: () => {
      rmSync(join(root, 'hook-fault'), { force: true });
    },
    readHeld: () => existsSync(join(root, 'hook-held')),
  };
}

test('it counts every brief command of six hook processes that start at once', async () => {
  const ctx = await setupTest();

  await ctx.send(ctx.sessionStart);

  const results = await Promise.all(Array.from({ length: 6 }, () => ctx.send(ctx.brief)));

  expect({
    exits: results.map((result) => result.exitCode),
    gate: ctx.gate(),
  }).toStrictEqual({
    exits: [0, 0, 0, 0, 0, 0],
    gate: 'state=reading session=tide-alerts reads=6 spare=1',
  });
});

test('it takes the lock again once a process that held it is killed', async () => {
  const ctx = await setupTest();

  await ctx.send(ctx.sessionStart);

  ctx.holdFault();

  const holder = await ctx.startHolder(ctx.brief);

  await waitFor(() => ctx.readHeld());

  await holder.stop('SIGKILL');

  ctx.clearFault();

  const result = await ctx.send(ctx.brief);

  expect({ exitCode: result.exitCode, gate: ctx.gate() }).toStrictEqual({
    exitCode: 0,
    gate: expect.stringContaining('state=reading session=tide-alerts'),
  });
});
