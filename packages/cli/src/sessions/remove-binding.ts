import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentID } from '../types.ts';
import { buildAgentFileName } from './build-agent-file-name.ts';

// Returns whether a binding file was there to remove.
export async function removeBinding(root: string, agent: AgentID): Promise<boolean> {
  const path = join(root, '.bindings', buildAgentFileName(agent));

  try {
    await stat(path);
  } catch {
    return false;
  }

  await rm(path, { force: true });

  return true;
}
