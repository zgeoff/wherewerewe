import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { checkLimits } from './check-limits.ts';
import { probePullRequest } from './probe-pull-request.ts';
import { createKillSet, runCommand } from './run-command.ts';
import type { CheckProbe, RunProbeCommand } from './types.ts';

function setupTest() {
  const folder = createTempDir('probe-pr').path;
  const target = { repo: 'bosunhq/bosun-api', number: '77' };

  const runWith: RunProbeCommand = (argv, timeoutMs) =>
    runCommand(argv, { env: { PATH: folder }, timeoutMs, kills: createKillSet() });

  return {
    target,
    probeJSON: (json: string): Promise<CheckProbe> => {
      seedStubCommand(folder, 'gh', `printf '%s' '${json}'`);

      return probePullRequest(target, runWith);
    },
    probeFailure: (stderr: string): Promise<CheckProbe> => {
      seedStubCommand(folder, 'gh', `echo '${stderr}' >&2\nexit 1`);

      return probePullRequest(target, runWith);
    },
    probeWithNoGh: (): Promise<CheckProbe> => probePullRequest(target, runWith),
    logArgv: (): Promise<CheckProbe> => {
      seedStubCommand(
        folder,
        'gh',
        `echo "$@" > "${join(folder, 'argv')}"\nprintf '%s' '{"state":"MERGED"}'`,
      );

      return probePullRequest(target, runWith);
    },
    folder,
  };
}

test.each([
  ['MERGED', '{"state":"MERGED","statusCheckRollup":[]}', 'MERGED'],
  ['CLOSED', '{"state":"CLOSED","statusCheckRollup":[]}', 'CLOSED'],
  ['an empty rollup', '{"state":"OPEN","statusCheckRollup":[]}', 'OPEN no checks'],
  [
    'checks that all completed with success',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"SUCCESS"},{"context":"deploy","state":"SUCCESS"}]}',
    'OPEN passing',
  ],
  [
    'a check that is still in progress',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"SUCCESS"},{"name":"e2e","status":"IN_PROGRESS","conclusion":""}]}',
    'OPEN pending',
  ],
  [
    'a status context that is pending',
    '{"state":"OPEN","statusCheckRollup":[{"context":"deploy","state":"PENDING"}]}',
    'OPEN pending',
  ],
  [
    'a status context that is expected',
    '{"state":"OPEN","statusCheckRollup":[{"context":"deploy","state":"EXPECTED"}]}',
    'OPEN pending',
  ],
  [
    'a failed check beside one in progress',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"FAILURE"},{"name":"e2e","status":"QUEUED","conclusion":""}]}',
    'OPEN failing',
  ],
  [
    'a cancelled check',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"CANCELLED"}]}',
    'OPEN failing',
  ],
  [
    'a timed out check',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"TIMED_OUT"}]}',
    'OPEN failing',
  ],
  [
    'a check that needs action',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"ACTION_REQUIRED"}]}',
    'OPEN failing',
  ],
  [
    'a check that failed at startup',
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"STARTUP_FAILURE"}]}',
    'OPEN failing',
  ],
  [
    'a status context in error',
    '{"state":"OPEN","statusCheckRollup":[{"context":"deploy","state":"ERROR"}]}',
    'OPEN failing',
  ],
  [
    'a status context that failed',
    '{"state":"OPEN","statusCheckRollup":[{"context":"deploy","state":"FAILURE"}]}',
    'OPEN failing',
  ],
])('it reads %s as %s', async (_title, json, result) => {
  const ctx = setupTest();

  const probe = await ctx.probeJSON(json);

  expect(probe.result).toStrictEqual({ kind: 'result', result });
});

test('it names the checks that failed beside OPEN failing', async () => {
  const ctx = setupTest();

  const probe = await ctx.probeJSON(
    '{"state":"OPEN","statusCheckRollup":[{"name":"lint","status":"COMPLETED","conclusion":"FAILURE"},{"name":"unit","status":"COMPLETED","conclusion":"SUCCESS"},{"context":"deploy","state":"ERROR"}]}',
  );

  expect(probe).toStrictEqual({
    result: { kind: 'result', result: 'OPEN failing' },
    failing: ['lint', 'deploy'],
  });
});

test.each([
  [
    'Could not resolve to a PullRequest with the number of 77',
    { kind: 'result', result: 'not found' },
  ],
  [
    'Could not resolve to a Repository with the name bosunhq/nothing',
    { kind: 'result', result: 'not found' },
  ],
  [
    'To get started with GitHub CLI, please run: gh auth login',
    { kind: 'unchecked', reason: 'gh not logged in' },
  ],
  ['HTTP 401: Bad credentials', { kind: 'unchecked', reason: 'gh not logged in' }],
  ['error connecting to api.github.com', { kind: 'unchecked', reason: 'offline' }],
  ['dial tcp: lookup api.github.com: no such host', { kind: 'unchecked', reason: 'offline' }],
  ['something nobody planned for', { kind: 'unchecked', reason: 'offline' }],
] as const)('it reads the stderr %p of a failed gh as %p', async (stderr, result) => {
  const ctx = setupTest();

  const probe = await ctx.probeFailure(stderr);

  expect(probe.result).toStrictEqual(result);
});

test('it reads output that is not a pull request view as unchecked with offline', async () => {
  const ctx = setupTest();

  const probe = await ctx.probeJSON('not json');

  expect(probe.result).toStrictEqual({ kind: 'unchecked', reason: 'offline' });
});

test('it reads unchecked with gh missing when no gh is on the PATH', async () => {
  const ctx = setupTest();

  const probe = await ctx.probeWithNoGh();

  expect(probe.result).toStrictEqual({ kind: 'unchecked', reason: 'gh missing' });
});

test('it asks gh for the state and the rollup of the one pull request, and no more', async () => {
  const ctx = setupTest();

  await ctx.logArgv();

  const argv = await Bun.file(join(ctx.folder, 'argv')).text();

  expect(argv).toBe('pr view 77 -R bosunhq/bosun-api --json state,statusCheckRollup\n');
});

test('it reads unchecked with timeout when the command runs past 4 s', async () => {
  const limits: number[] = [];

  const probe = await probePullRequest(
    { repo: 'bosunhq/bosun-api', number: '77' },
    (_argv, timeoutMs) => {
      limits.push(timeoutMs);

      return Promise.resolve({ kind: 'timeout' });
    },
  );

  expect([probe.result, limits]).toStrictEqual([
    { kind: 'unchecked', reason: 'timeout' },
    [checkLimits.probeTimeoutMs.pr],
  ]);
});
