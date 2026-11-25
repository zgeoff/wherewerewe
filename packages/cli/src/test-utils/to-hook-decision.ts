import { isRecord } from '../hooks/is-record.ts';

export type HookDecision =
  | 'pass'
  | 'refuse'
  | 'refuse-cut'
  | 'pass+line'
  | 'block'
  | 'inject'
  | 'context'
  | 'other';

// What a hook's stdout does, read from its text: nothing, a refusal, a pass with the fail-open
// line, a Stop block, the injection, or another line of context.
export function toHookDecision(stdout: string): HookDecision {
  if (stdout === '') {
    return 'pass';
  }

  if (stdout.startsWith('GOAL') || stdout.startsWith('wherewerewe: this session')) {
    return 'inject';
  }

  const parsed = parseJSONOrNull(stdout);
  const output = isRecord(parsed) ? parsed['hookSpecificOutput'] : undefined;

  if (isRecord(parsed) && parsed['decision'] === 'block') {
    return 'block';
  }

  if (!isRecord(output)) {
    return 'other';
  }

  if (output['permissionDecision'] === 'deny') {
    return String(output['permissionDecisionReason']).includes('reached you cut')
      ? 'refuse-cut'
      : 'refuse';
  }

  const context = output['additionalContext'];

  if (typeof context !== 'string') {
    return 'other';
  }

  return context.includes('printed no whole brief') ? 'pass+line' : 'context';
}

function parseJSONOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
