import { readFile } from 'node:fs/promises';
import type { AgentID } from '../types.ts';
import { bindingPath } from './binding-path.ts';
import { isName } from './is-name.ts';

export async function readBinding(root: string, agent: AgentID): Promise<string | null> {
  const text = await readFile(bindingPath(root, agent), 'utf8').catch(() => null);

  const name = text === null ? undefined : /^name=(?<name>.+)$/mu.exec(text)?.groups?.['name'];

  return name !== undefined && isName(name) ? name : null;
}
