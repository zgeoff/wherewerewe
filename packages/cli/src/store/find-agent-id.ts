import type { AgentID, Env } from '../types.ts';
import { isID } from './is-id.ts';

// The host session this shell runs in, when a host started it.
export function findAgentID(env: Env): AgentID | null {
  const claude = env['CLAUDE_CODE_SESSION_ID'];

  if (claude !== undefined && isID(claude)) {
    return { harness: 'claude', id: claude };
  }

  const codex = env['CODEX_SESSION_ID'] ?? env['CODEX_THREAD_ID'];

  return codex !== undefined && isID(codex) ? { harness: 'codex', id: codex } : null;
}
