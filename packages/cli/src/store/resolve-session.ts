import { RefusalError } from '../refusal-error.ts';
import type { Env } from '../types.ts';
import { findAgentID } from './find-agent-id.ts';
import { isName } from './is-name.ts';
import { probeSession } from './probe-session.ts';
import { readBinding } from './read-binding.ts';

// The session a command works on: the --session flag, then the variable, then the host's binding.
export async function resolveSession(
  root: string,
  env: Env,
  flag: string | undefined,
): Promise<string> {
  const agent = findAgentID(env);
  const bound = agent === null ? null : await readBinding(root, agent);
  const name = flag ?? env['WHEREWEREWE_SESSION'] ?? bound;

  if (name === null || name === undefined) {
    throw new RefusalError(
      'no session: this shell is bound to none',
      'www sessions   then   www attach <name>   or   www init <name> --goal "<goal>"',
      4,
    );
  }

  const exists = isName(name) ? await probeSession(root, name) : false;

  if (!exists) {
    throw new RefusalError(`no session is named ${name}`, 'www sessions', 4);
  }

  return name;
}
