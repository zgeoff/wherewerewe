import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import type { Harness } from '../src/hooks/types.ts';
import { buildHookPayload } from '../src/test-utils/build-hook-payload.ts';
import type { HookPayloadSpec } from '../src/test-utils/build-hook-payload.ts';
import { boundHookID, buildHookTimingCases } from '../src/test-utils/build-hook-timing-cases.ts';
import { seedHookStore } from '../src/test-utils/seed-hook-store.ts';

async function setupTest(harness: Harness) {
  const runs = 20;

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

  await seedHookStore(join(stateHome, 'wherewerewe'), { harness, id: boundHookID }, 'tide-alerts');

  // WHEREWEREWE_BIN, when set, names a built binary to time in place of the source
  const command = Bun.env['WHEREWEREWE_BIN']?.split(' ') ?? program.command;

  const send = (spec: HookPayloadSpec, id: string) =>
    run(command, {
      cwd: program.cwd,
      env,
      args: ['hook', harness],
      input: buildHookPayload(harness, id, spec),
    });

  return {
    send,
    timeRuns: async (spec: HookPayloadSpec, id: string) => {
      const times: number[] = [];
      const exitCodes: number[] = [];

      for (let index = 0; index < runs; index += 1) {
        const startedAt = performance.now();

        const result = await send(spec, id);

        times.push(performance.now() - startedAt);
        exitCodes.push(result.exitCode);
      }

      return {
        medianMs:
          times.toSorted((left, right) => left - right)[runs / 2] ?? Number.POSITIVE_INFINITY,
        exitCodes: [...new Set(exitCodes)],
      };
    },
  };
}

test.each(buildHookTimingCases())(
  'it answers $title on $harness with a median under $limitMs ms and exit 0 every time',
  async (row) => {
    const ctx = await setupTest(row.harness);

    // a bound session is gated first, so a call, an end and a Stop meet a real gate file
    await ctx.send({ event: 'SessionStart' }, boundHookID);

    const timed = await ctx.timeRuns(row.spec, row.id);

    console.log(`${row.harness} ${row.title}: median ${timed.medianMs.toFixed(0)} ms`);

    expect({ exitCodes: timed.exitCodes, isFast: timed.medianMs < row.limitMs }).toStrictEqual({
      exitCodes: [0],
      isFast: true,
    });
  },
);
