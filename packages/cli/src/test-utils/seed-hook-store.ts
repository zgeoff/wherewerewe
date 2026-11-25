import type { Harness } from '../hooks/types.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { seedSessionStore } from './seed-session-store.ts';

interface HookAgent {
  readonly harness: Harness;
  readonly id: string;
}

// A session store under the root, made through the store module, with a binding for the agent
// session id, made through the sessions module. Returns the session folder.
export async function seedHookStore(root: string, agent: HookAgent, name: string): Promise<string> {
  const folder = await seedSessionStore(root, name);

  await writeBinding(root, agent, name);

  return folder;
}
