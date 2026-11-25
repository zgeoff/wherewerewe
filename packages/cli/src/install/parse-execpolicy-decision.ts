import { isRecord } from '../hooks/is-record.ts';

// The strictest decision that `codex execpolicy check` printed: the string in the `decision` field
// of its JSON. The Codex docs say the output shows "the strictest decision and any matching
// rules" and do not name the fields, so this reads `decision` and gives `null` for anything else.
export function parseExecpolicyDecision(stdout: string): string | null {
  try {
    const value: unknown = JSON.parse(stdout);

    return isRecord(value) && typeof value['decision'] === 'string' ? value['decision'] : null;
  } catch {
    return null;
  }
}
