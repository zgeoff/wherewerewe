import { expect, test } from 'bun:test';
import { parseHookEnvelope } from './parse-hook-envelope.ts';

function setupTest() {
  return { parse: parseHookEnvelope };
}

test('it reads the shared fields and ignores every other field', () => {
  const ctx = setupTest();

  const text = JSON.stringify({
    session_id: '9e1f-trial',
    hook_event_name: 'PreToolUse',
    agent_id: 'sub-1',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    cwd: '/work/tide-chart',
    transcript_path: '/work/transcript.jsonl',
  });

  expect(ctx.parse(text)).toStrictEqual({
    event: 'PreToolUse',
    sessionID: '9e1f-trial',
    agentID: 'sub-1',
    source: null,
    toolName: 'Bash',
    toolInput: { command: 'ls' },
    toolResponse: undefined,
    stopHookActive: false,
  });
});

test.each([
  { title: 'text that is not JSON', text: '{' },
  { title: 'a JSON array', text: '[]' },
  { title: 'a payload with no session id', text: '{"hook_event_name":"Stop"}' },
  { title: 'a payload with no event name', text: '{"session_id":"9e1f-trial"}' },
])('it returns null for $title', (row) => {
  const ctx = setupTest();

  expect(ctx.parse(row.text)).toBeNull();
});
