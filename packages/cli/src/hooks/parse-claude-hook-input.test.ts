import { expect, test } from 'bun:test';
import { parseClaudeHookInput } from './parse-claude-hook-input.ts';

function setupTest() {
  return { parse: parseClaudeHookInput, session: '9e1f-trial' };
}

test('it reads the stdout of a Bash tool response as the output', () => {
  const ctx = setupTest();

  const text = JSON.stringify({
    session_id: ctx.session,
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'www' },
    tool_response: {
      stdout: 'tide-alerts · day 3\n',
      stderr: '',
      interrupted: false,
      isImage: false,
    },
  });

  expect(ctx.parse(text)).toStrictEqual({
    event: 'PostToolUse',
    harness: 'claude',
    sessionID: ctx.session,
    agentID: null,
    toolName: 'Bash',
    command: 'www',
    response: 'tide-alerts · day 3\n',
    exitCode: null,
    maxOutputTokens: null,
  });
});

test.each([
  {
    title: 'SessionStart',
    payload: { hook_event_name: 'SessionStart', source: 'compact' },
    input: { event: 'SessionStart', source: 'compact' },
  },
  {
    title: 'PreToolUse',
    payload: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } },
    input: { event: 'PreToolUse', agentID: null, toolName: 'Bash', command: 'ls' },
  },
  {
    title: 'PostToolUseFailure',
    payload: {
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command: 'www' },
      agent_id: 'sub-1',
    },
    input: { event: 'PostToolUseFailure', agentID: 'sub-1', toolName: 'Bash', command: 'www' },
  },
  {
    title: 'SubagentStart',
    payload: { hook_event_name: 'SubagentStart' },
    input: { event: 'SubagentStart' },
  },
  {
    title: 'Stop',
    payload: { hook_event_name: 'Stop', stop_hook_active: true },
    input: { event: 'Stop', agentID: null, stopHookActive: true },
  },
] as const)('it reads a $title payload', (row) => {
  const ctx = setupTest();
  const text = JSON.stringify({ session_id: ctx.session, ...row.payload });

  expect(ctx.parse(text)).toStrictEqual({
    harness: 'claude',
    sessionID: ctx.session,
    ...row.input,
  });
});

test('it returns null for an event the hooks do not use', () => {
  const ctx = setupTest();

  expect(
    ctx.parse(JSON.stringify({ session_id: ctx.session, hook_event_name: 'Notification' })),
  ).toBeNull();
});
