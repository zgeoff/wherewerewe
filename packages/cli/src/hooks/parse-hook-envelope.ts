import { isRecord } from './is-record.ts';

// The fields of a hook's stdin that every harness shares, and no other field.
export interface HookEnvelope {
  readonly event: string;
  readonly sessionID: string;
  readonly agentID: string | null;
  readonly source: string | null;

  // empty when the payload names none
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
  readonly toolResponse: unknown;
  readonly stopHookActive: boolean;
}

// Null when the text is not a JSON object with an event name and a session id.
export function parseHookEnvelope(text: string): HookEnvelope | null {
  const payload = parseJSON(text);

  if (!isRecord(payload)) {
    return null;
  }

  const event = payload['hook_event_name'];
  const sessionID = payload['session_id'];
  const agentID = payload['agent_id'];
  const source = payload['source'];
  const toolName = payload['tool_name'];
  const toolInput = payload['tool_input'];

  if (typeof event !== 'string' || typeof sessionID !== 'string' || sessionID === '') {
    return null;
  }

  return {
    event,
    sessionID,
    agentID: typeof agentID === 'string' && agentID !== '' ? agentID : null,
    source: typeof source === 'string' ? source : null,
    toolName: typeof toolName === 'string' ? toolName : '',
    toolInput: isRecord(toolInput) ? toolInput : {},
    toolResponse: payload['tool_response'],
    stopHookActive: payload['stop_hook_active'] === true,
  };
}

function parseJSON(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);

    return value;
  } catch {
    return null;
  }
}
