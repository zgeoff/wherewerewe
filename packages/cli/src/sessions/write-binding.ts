import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import type { AgentID } from '../types.ts';

export async function writeBinding(root: string, agent: AgentID, name: string): Promise<void> {
  const folder = join(root, '.bindings');

  await mkdir(folder, { recursive: true });

  writeFileAtomic(join(folder, `${agent.harness}-${agent.id}`), `name=${name}\n`);
}
