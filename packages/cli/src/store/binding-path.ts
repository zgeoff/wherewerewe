import { join } from 'node:path';
import type { AgentID } from '../types.ts';

export function bindingPath(root: string, agent: AgentID): string {
  return join(root, '.bindings', `${agent.harness}-${agent.id}`);
}
