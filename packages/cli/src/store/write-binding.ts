import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentID } from '../types.ts';
import { bindingPath } from './binding-path.ts';

export async function writeBinding(root: string, agent: AgentID, name: string): Promise<void> {
  await mkdir(join(root, '.bindings'), { recursive: true });
  await writeFile(bindingPath(root, agent), `name=${name}\n`);
}
