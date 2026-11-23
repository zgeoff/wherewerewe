import { isSetVariable } from '../rules/is-set-variable.ts';
import type { AgentID } from '../types.ts';

// An empty value counts as unset, and so does one with a character that a binding file name
// cannot hold.
export function findAgentID(env: Readonly<Record<string, string | undefined>>): AgentID | null {
  const claude = findID(env['CLAUDE_CODE_SESSION_ID']);

  if (claude !== null) {
    return { harness: 'claude', id: claude };
  }

  const codex = findID(env['CODEX_SESSION_ID']) ?? findID(env['CODEX_THREAD_ID']);

  return codex === null ? null : { harness: 'codex', id: codex };
}

function findID(value: string | undefined): string | null {
  return isSetVariable(value) && /^[A-Za-z0-9-]+$/u.test(value) ? value : null;
}
