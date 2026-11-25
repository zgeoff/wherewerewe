import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentID } from '../types.ts';
import { buildAgentFileName } from './build-agent-file-name.ts';

export async function readBinding(root: string, agent: AgentID): Promise<string | null> {
  try {
    const text = await readFile(join(root, '.bindings', buildAgentFileName(agent)), 'utf8');

    const match = /^name=(?<name>.+)$/mu.exec(text);

    return match?.groups?.['name'] ?? null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
