import { rm } from 'node:fs/promises';
import type { AgentID } from '../types.ts';
import { bindingPath } from './binding-path.ts';

export async function removeBinding(root: string, agent: AgentID): Promise<void> {
  await rm(bindingPath(root, agent), { force: true });
}
