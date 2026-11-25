import type { AgentID } from '../types.ts';

// The name of an agent session's binding file and gate file. An id holds letters, digits and dashes
// only, as findAgentID takes it, so no id can name a path outside the folder.
export function buildAgentFileName(agent: AgentID): string {
  if (!/^[A-Za-z0-9-]+$/u.test(agent.id)) {
    throw new Error('an agent session id holds a character a file name cannot');
  }

  return `${agent.harness}-${agent.id}`;
}
