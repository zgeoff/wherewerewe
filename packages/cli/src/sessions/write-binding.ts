import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import type { AgentID } from '../types.ts';
import { buildAgentFileName } from './build-agent-file-name.ts';

export async function writeBinding(root: string, agent: AgentID, name: string): Promise<void> {
  const folder = join(root, '.bindings');

  await mkdir(folder, { recursive: true });

  writeFileAtomic(join(folder, buildAgentFileName(agent)), `name=${name}\n`);
}
