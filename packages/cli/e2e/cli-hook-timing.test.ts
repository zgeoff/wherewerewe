import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { buildHookPayload } from '../src/test-utils/build-hook-payload.ts';
import { seedHookStore } from '../src/test-utils/seed-hook-store.ts';

async function setupTest() {
  const program = await resolveProgram('www');

  const stateHome = createTempDir('hook-timing').path;

  const env = {
    XDG_STATE_HOME: stateHome,
    HOME: stateHome,
    CLAUDE_CODE_SESSION_ID: '',
    CODEX_SESSION_ID: '',
    CODEX_THREAD_ID: '',
    WHEREWEREWE_SESSION: '',
  };

  await seedHookStore(
    join(stateHome, 'wherewerewe'),
    { harness: 'claude', id: '9e1f-trial' },
    'tide-alerts',
  );

  // WHEREWEREWE_BIN, when set, names a built binary to time in place of the source
  const command = Bun.env['WHEREWEREWE_BIN']?.split(' ') ?? program.command;

  const medianMs = async (text: string): Promise<number> => {
    const times: number[] = [];

    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();

      await run(command, { cwd: program.cwd, env, args: ['hook', 'claude'], input: text });

      times.push(performance.now() - startedAt);
    }

    return times.toSorted((left, right) => left - right)[10] ?? Number.POSITIVE_INFINITY;
  };

  return {
    medianMs,
    sessionStart: buildHookPayload('claude', '9e1f-trial', { event: 'SessionStart' }),
    pre: buildHookPayload('claude', '9e1f-trial', {
      event: 'PreToolUse',
      command: 'ls',
    }),
    post: buildHookPayload('claude', '9e1f-trial', {
      event: 'PostToolUse',
      command: 'ls',
      output: 'a b',
    }),
  };
}

test('it answers a PreToolUse hook with a median under 150 ms, a PostToolUse under 150 ms and a SessionStart under 300 ms', async () => {
  const ctx = await setupTest();

  const medians = {
    start: await ctx.medianMs(ctx.sessionStart),
    pre: await ctx.medianMs(ctx.pre),
    post: await ctx.medianMs(ctx.post),
  };

  console.log(`hook medians in ms: ${JSON.stringify(medians)}`);

  expect({
    isStartFast: medians.start < 300,
    isPreFast: medians.pre < 150,
    isPostFast: medians.post < 150,
  }).toStrictEqual({ isStartFast: true, isPreFast: true, isPostFast: true });
});
