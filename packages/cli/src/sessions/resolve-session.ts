import type { AgentID } from '../types.ts';
import { findAgentID } from './find-agent-id.ts';
import { readBinding } from './read-binding.ts';

export type SessionResolution =
  | {
      readonly kind: 'found';
      readonly name: string;
      readonly via: 'flag' | 'env' | 'binding';
      readonly agent: AgentID | null;
    }
  | { readonly kind: 'none'; readonly named: string | null; readonly agent: AgentID | null };

interface SessionRequest {
  readonly flag: string | null;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly root: string;
}

// The first rule that gives a name wins: --session, WHEREWEREWE_SESSION, then the binding of the
// agent session id. It never falls back to a default or to the only session.
export async function resolveSession(input: SessionRequest): Promise<SessionResolution> {
  const agent = findAgentID(input.env);

  if (input.flag !== null && input.flag !== '') {
    return { kind: 'found', name: input.flag, via: 'flag', agent };
  }

  const fromEnv = input.env['WHEREWEREWE_SESSION'];

  if (fromEnv !== undefined && fromEnv !== '') {
    return { kind: 'found', name: fromEnv, via: 'env', agent };
  }

  const bound = await readSessionBinding(input.root, input.env);

  return bound === null
    ? { kind: 'none', named: null, agent }
    : { kind: 'found', name: bound, via: 'binding', agent };
}

async function readSessionBinding(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string | null> {
  const claude = findAgentID({ CLAUDE_CODE_SESSION_ID: env['CLAUDE_CODE_SESSION_ID'] });

  if (claude !== null) {
    const name = await readBinding(root, claude);

    if (name !== null) {
      return name;
    }
  }

  const codex = findAgentID({
    CODEX_SESSION_ID: env['CODEX_SESSION_ID'],
    CODEX_THREAD_ID: env['CODEX_THREAD_ID'],
  });

  return codex === null ? null : readBinding(root, codex);
}
