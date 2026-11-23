import { formatTimestamp } from '../format-timestamp.ts';
import type { AgentID, JournalRow } from '../types.ts';

export function buildBindRow(
  name: string,
  text: string,
  agent: AgentID,
  nowMs: number,
): JournalRow {
  return {
    ts: formatTimestamp(nowMs),
    op: 'bind',
    id: name,
    by: 'agent',
    text,
    why: null,
    extra: `harness=${agent.harness};agent=${agent.id}`,
  };
}
