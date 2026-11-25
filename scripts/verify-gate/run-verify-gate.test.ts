import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runVerifyGate } from './run-verify-gate.ts';

function setupTest() {
  const temp = createTempDir('verify-gate-');
  const calls: string[][] = [];

  return {
    temp,
    calls,
    writeEvent: async (pullRequest: unknown) => {
      const eventPath = join(temp.path, 'event.json');

      await Bun.write(eventPath, JSON.stringify({ pull_request: pullRequest }));

      return eventPath;
    },
    run: (env: Record<string, string | undefined>, exitCode = 0) =>
      runVerifyGate({
        env,
        runCommand: (argv) => {
          calls.push([...argv]);

          return Promise.resolve(exitCode);
        },
      }),
  };
}

test('it hands the pull request body to the gate in a file under RUNNER_TEMP', async () => {
  const ctx = setupTest();

  const eventPath = await ctx.writeEvent({
    body: '## Verification\n\nthe report',
    base: { ref: 'main', repo: { full_name: 'acme/notes' } },
    head: { ref: 'add-notes', repo: { full_name: 'acme/notes' } },
    user: { type: 'User', login: 'river-otter' },
  });

  const bodyFile = join(ctx.temp.path, 'pr-body.md');

  await ctx.run({ GITHUB_EVENT_PATH: eventPath, RUNNER_TEMP: ctx.temp.path });

  expect({ calls: ctx.calls, body: await Bun.file(bodyFile).text() }).toStrictEqual({
    calls: [['bun', 'verify', 'gate', '--base', 'origin/main', '--body-file', bodyFile]],
    body: '## Verification\n\nthe report',
  });
});

test.each([[0], [1], [3]])(
  'it returns the exit code %d that the gate returns',
  async (exitCode) => {
    const ctx = setupTest();

    const eventPath = await ctx.writeEvent({
      body: '## Verification\n\nthe report',
      base: { ref: 'main', repo: { full_name: 'acme/notes' } },
      head: { ref: 'add-notes', repo: { full_name: 'acme/notes' } },
      user: { type: 'User', login: 'river-otter' },
    });

    const code = await ctx.run(
      { GITHUB_EVENT_PATH: eventPath, RUNNER_TEMP: ctx.temp.path },
      exitCode,
    );

    expect(code).toBe(exitCode);
  },
);

test('it passes a release pull request without running the gate', async () => {
  const ctx = setupTest();

  const eventPath = await ctx.writeEvent({
    body: null,
    base: { ref: 'main', repo: { full_name: 'acme/notes' } },
    head: {
      ref: 'release-please--branches--main--components--@wherewerewe/cli',
      repo: { full_name: 'acme/notes' },
    },
    user: { type: 'Bot', login: 'zgeoff-release-please[bot]' },
  });

  const code = await ctx.run({ GITHUB_EVENT_PATH: eventPath, RUNNER_TEMP: ctx.temp.path }, 7);

  expect({ code, calls: ctx.calls }).toStrictEqual({ code: 0, calls: [] });
});

test('it fails without running the gate when the event holds no pull request', async () => {
  const ctx = setupTest();
  const eventPath = join(ctx.temp.path, 'event.json');

  await Bun.write(eventPath, JSON.stringify({ ref: 'refs/heads/main' }));

  const code = await ctx.run({ GITHUB_EVENT_PATH: eventPath, RUNNER_TEMP: ctx.temp.path });

  expect({ code, calls: ctx.calls }).toStrictEqual({ code: 1, calls: [] });
});

test.each([
  ['GITHUB_EVENT_PATH', { RUNNER_TEMP: '/runner/temp' }],
  ['RUNNER_TEMP', { GITHUB_EVENT_PATH: '/runner/event.json' }],
])('it fails without running the gate when %s is not set', async (_name, env) => {
  const ctx = setupTest();

  const code = await ctx.run(env);

  expect({ code, calls: ctx.calls }).toStrictEqual({ code: 1, calls: [] });
});
