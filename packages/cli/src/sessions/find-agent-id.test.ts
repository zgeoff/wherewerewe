import { expect, test } from 'bun:test';
import { findAgentID } from './find-agent-id.ts';

test.each([
  [{ CLAUDE_CODE_SESSION_ID: 'a1-b2' }, { harness: 'claude', id: 'a1-b2' }],
  [{ CODEX_SESSION_ID: 'c3' }, { harness: 'codex', id: 'c3' }],
  [{ CODEX_THREAD_ID: 'd4' }, { harness: 'codex', id: 'd4' }],
  [
    { CODEX_SESSION_ID: 'c3', CODEX_THREAD_ID: 'd4' },
    { harness: 'codex', id: 'c3' },
  ],
  [
    { CLAUDE_CODE_SESSION_ID: 'a1', CODEX_SESSION_ID: 'c3' },
    { harness: 'claude', id: 'a1' },
  ],
  [
    { CLAUDE_CODE_SESSION_ID: '', CODEX_SESSION_ID: 'c3' },
    { harness: 'codex', id: 'c3' },
  ],
  [{ CLAUDE_CODE_SESSION_ID: '../x' }, null],
  [
    { CODEX_SESSION_ID: 'a b', CODEX_THREAD_ID: 'd4' },
    { harness: 'codex', id: 'd4' },
  ],
  [{}, null],
])('it finds the agent for %p as %p', (env, expected) => {
  const actual: unknown = findAgentID(env);

  expect(actual).toStrictEqual(expected);
});
