import { expect, test } from 'bun:test';
import { buildHookPayload } from './build-hook-payload.ts';

function setupTest() {
  return { build: buildHookPayload };
}

test('it builds the Claude Code shape of a PostToolUse with an object tool response', () => {
  const ctx = setupTest();

  const text = ctx.build('claude', '9e1f-trial', {
    event: 'PostToolUse',
    command: 'www',
    output: 'tide-alerts · day 3\n',
  });

  expect(JSON.parse(text)).toStrictEqual({
    session_id: '9e1f-trial',
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
});

test('it builds the Codex shape of a PostToolUse with a string tool response and a cap', () => {
  const ctx = setupTest();

  const text = ctx.build('codex', '019a-trial', {
    event: 'PostToolUse',
    command: 'www',
    output: 'x',
    maxOutputTokens: 10_000,
    agentID: 'sub-1',
  });

  expect(JSON.parse(text)).toStrictEqual({
    session_id: '019a-trial',
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'www', max_output_tokens: 10_000 },
    tool_response: 'x',
    agent_id: 'sub-1',
  });
});

test.each([
  { spec: { event: 'SessionStart' }, fields: { source: 'startup' } },
  {
    spec: { event: 'PreToolUse', command: 'ls' },
    fields: { tool_name: 'Bash', tool_input: { command: 'ls' } },
  },
  { spec: { event: 'Stop', stopHookActive: true }, fields: { stop_hook_active: true } },
  { spec: { event: 'SubagentStart' }, fields: { agent_id: 'sub-1' } },
] as const)('it builds a $spec.event payload', (row) => {
  const ctx = setupTest();

  expect(JSON.parse(ctx.build('claude', '9e1f-trial', row.spec))).toStrictEqual({
    session_id: '9e1f-trial',
    hook_event_name: row.spec.event,
    ...row.fields,
  });
});
