import { isID } from '../store/is-id.ts';
import { isRecord } from '../utils/is-record.ts';
import type { Payload } from './types.ts';

export function parsePayload(text: string): Payload | null {
  const value: unknown = JSON.parse(text);

  if (!isRecord(value)) {
    return null;
  }

  const event = value['hook_event_name'];
  const sessionID = value['session_id'];

  if (typeof event !== 'string' || typeof sessionID !== 'string' || !isID(sessionID)) {
    return null;
  }

  const input = value['tool_input'];
  const command = isRecord(input) ? input['command'] : null;

  return {
    event,
    sessionID,
    isSubagent: typeof value['agent_id'] === 'string' && value['agent_id'] !== '',
    command: toCommandText(command),
  };
}

// Claude Code sends the command as text, and Codex may send it as a list of words.
function toCommandText(command: unknown): string | null {
  if (Array.isArray(command)) {
    return command.join(' ');
  }

  return typeof command === 'string' ? command : null;
}
