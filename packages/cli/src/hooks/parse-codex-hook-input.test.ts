import { expect, test } from 'bun:test';
import { parseCodexHookInput } from './parse-codex-hook-input.ts';

function setupTest() {
  return { parse: parseCodexHookInput, session: '019a-trial' };
}

// invented: the Codex docs give no shell tool_response shape; step C9 replaces it
test.each([
  {
    title: 'a string',
    response: 'tide-alerts · day 3\n',
    text: 'tide-alerts · day 3\n',
    exitCode: null,
  },
  {
    title: 'an object with output and an exit code',
    response: { output: 'tide-alerts · day 3\n', exit_code: 1 },
    text: 'tide-alerts · day 3\n',
    exitCode: 1,
  },
  {
    title: 'an object with stdout',
    response: { stdout: 'tide-alerts · day 3\n', exitCode: 0 },
    text: 'tide-alerts · day 3\n',
    exitCode: 0,
  },
  {
    title: 'an object with neither field',
    response: { result: 'x' },
    text: '{"result":"x"}',
    exitCode: null,
  },
] as const)('it reads a tool response that is $title', (row) => {
  const ctx = setupTest();

  const text = JSON.stringify({
    session_id: ctx.session,
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'www', max_output_tokens: 10_000 },
    tool_response: row.response,
  });

  expect(ctx.parse(text)).toStrictEqual({
    event: 'PostToolUse',
    harness: 'codex',
    sessionID: ctx.session,
    agentID: null,
    toolName: 'Bash',
    command: 'www',
    response: row.text,
    exitCode: row.exitCode,
    maxOutputTokens: 10_000,
  });
});

test('it returns null for PostToolUseFailure, which Codex never sends', () => {
  const ctx = setupTest();
  const text = JSON.stringify({ session_id: ctx.session, hook_event_name: 'PostToolUseFailure' });

  expect(ctx.parse(text)).toBeNull();
});

test('it reads a PreToolUse payload of an apply_patch call with no command', () => {
  const ctx = setupTest();

  const text = JSON.stringify({
    session_id: ctx.session,
    hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch',
    tool_input: {},
  });

  expect(ctx.parse(text)).toStrictEqual({
    event: 'PreToolUse',
    harness: 'codex',
    sessionID: ctx.session,
    agentID: null,
    toolName: 'apply_patch',
    command: null,
  });
});
