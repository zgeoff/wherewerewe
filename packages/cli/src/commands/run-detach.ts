import { findAgentID } from '../store/find-agent-id.ts';
import { readRoot } from '../store/read-root.ts';
import { removeBinding } from '../store/remove-binding.ts';
import type { Context, Reply } from '../types.ts';

export async function runDetach(context: Context): Promise<Reply> {
  const agent = findAgentID(context.env);

  if (agent !== null) {
    await removeBinding(readRoot(context.env), agent);
  }

  return { json: { ok: true }, human: 'This shell is bound to no session.' };
}
