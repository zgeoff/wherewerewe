import { RefusalError } from '../refusal-error.ts';
import { findAgentID } from '../store/find-agent-id.ts';
import { readBinding } from '../store/read-binding.ts';
import { readRoot } from '../store/read-root.ts';
import { writeBinding } from '../store/write-binding.ts';
import type { Context } from '../types.ts';

// Binds this host session to a notes session. A shell bound to another session keeps it unless
// --switch is given, so a test run from a live shell cannot move that shell's notes.
export async function bindSession(
  context: Context,
  name: string,
  isSwitching: boolean,
): Promise<boolean> {
  const agent = findAgentID(context.env);

  if (agent === null) {
    return false;
  }

  const root = readRoot(context.env);

  const current = await readBinding(root, agent);

  if (current !== null && current !== name && !isSwitching) {
    throw new RefusalError(
      `this shell is bound to ${current}; ${name} is ready, and this shell stays on ${current}`,
      `www attach ${name} --switch   or   www <command> --session ${name}`,
    );
  }

  await writeBinding(root, agent, name);

  return true;
}
