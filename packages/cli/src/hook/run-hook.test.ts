import { expect, test } from 'bun:test';
import { z } from 'zod';
import { writeBinding } from '../store/write-binding.ts';
import { buildHookPayload } from '../test-utils/build-hook-payload.ts';
import { createTestHome } from '../test-utils/create-test-home.ts';
import type { Harness } from '../types.ts';

async function setupTest() {
  const home = createTestHome();

  await home.www(['init', 'tide', '--goal', 'Ship the tide alerts']);

  return {
    ...home,
    hook: async (stdin: string, harness: Harness = 'claude') => {
      const result = await home.www(['hook', harness], { stdin });

      return result.stdout;
    },
  };
}

test('it lets every call through before a session start', async () => {
  const ctx = await setupTest();
  const output = await ctx.hook(buildHookPayload('PreToolUse', 'ls'));

  expect(output).toBe('');
});

test('it refuses a call after a session start, with the session name and the command to run', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));

  const reply = await ctx.hook(buildHookPayload('PreToolUse', 'ls'));

  const output = z
    .object({
      hookSpecificOutput: z.object({
        permissionDecision: z.string(),
        permissionDecisionReason: z.string(),
      }),
    })
    .parse(JSON.parse(reply));

  expect(output.hookSpecificOutput).toMatchObject({
    permissionDecision: 'deny',
    permissionDecisionReason:
      "wherewerewe: this session started or was compacted, and tide's brief is not in your context yet.\nRun: www",
  });
});

test('it lets the brief command through, and every call after it', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));

  const brief = await ctx.hook(buildHookPayload('PreToolUse', 'www'));
  const next = await ctx.hook(buildHookPayload('PreToolUse', 'ls'));

  expect([brief, next]).toStrictEqual(['', '']);
});

test('it refuses again after the next session start', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));
  await ctx.hook(buildHookPayload('PreToolUse', 'www'));
  await ctx.hook(buildHookPayload('SessionStart'));

  const output = await ctx.hook(buildHookPayload('PreToolUse', 'ls'));

  expect(output).toContain('"permissionDecision":"deny"');
});

test('it does not count www rows or a piped www as reading the brief', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));

  const rows = await ctx.hook(buildHookPayload('PreToolUse', 'www rows'));
  const piped = await ctx.hook(buildHookPayload('PreToolUse', 'www | head -1'));

  expect(rows).toContain('"permissionDecision":"deny"');
  expect(piped).toContain('"permissionDecision":"deny"');
});

test('it opens after three refusals, so a session is never trapped', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));

  const outputs: boolean[] = [];

  for (let index = 0; index < 5; index += 1) {
    const output = await ctx.hook(buildHookPayload('PreToolUse', 'ls'));

    outputs.push(output.includes('"permissionDecision":"deny"'));
  }

  expect(outputs).toStrictEqual([true, true, true, false, false]);
});

test('it lets a subagent call through', async () => {
  const ctx = await setupTest();

  await ctx.hook(buildHookPayload('SessionStart'));

  const output = await ctx.hook(buildHookPayload('PreToolUse', 'ls', { agent_id: 'sub-1' }));

  expect(output).toBe('');
});

test('it lets a call through for a host session bound to no notes', async () => {
  const ctx = await setupTest();

  const start = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'host-2' });

  const call = JSON.stringify({
    hook_event_name: 'PreToolUse',
    session_id: 'host-2',
    tool_input: { command: 'ls' },
  });

  const started = await ctx.hook(start);
  const called = await ctx.hook(call);

  expect([started, called]).toStrictEqual(['', '']);
});

test.each(['', 'not json', '{"hook_event_name":"PreToolUse","session_id":"../../etc"}'])(
  'it lets a call through for the payload %p',
  async (stdin) => {
    const ctx = await setupTest();
    const result = await ctx.www(['hook', 'claude'], { stdin });

    expect({ stdout: result.stdout, exitCode: result.exitCode }).toStrictEqual({
      stdout: '',
      exitCode: 0,
    });
  },
);

test('it gives Codex the same gate, with the output limit in its reason', async () => {
  const ctx = await setupTest();

  await writeBinding(ctx.root, { harness: 'codex', id: 'host-1' }, 'tide');

  await ctx.hook(buildHookPayload('SessionStart'), 'codex');

  const output = await ctx.hook(buildHookPayload('PreToolUse', "/bin/zsh -lc 'ls'"), 'codex');
  const brief = await ctx.hook(buildHookPayload('PreToolUse', '/bin/zsh -lc www'), 'codex');

  expect({ denied: output.includes('max_output_tokens 10000'), brief }).toStrictEqual({
    denied: true,
    brief: '',
  });
});
