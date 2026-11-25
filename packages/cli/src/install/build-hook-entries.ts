import type { Harness } from '../hooks/types.ts';
import { quoteShellWord } from '../refusals/quote-shell-word.ts';

export interface HookEntry {
  readonly event: string;
  readonly matcher: string | null;
  readonly timeoutSeconds: number;

  // exactly `<bin> hook <harness>`: the entry never changes between versions
  readonly command: string;
}

interface EventRow {
  readonly event: string;
  readonly matcher: string | null;
  readonly timeoutSeconds: number;
  readonly harnesses: readonly Harness[];
}

// The events table of sessions-and-hooks.md. A later version never changes a matcher or a timeout
// without a decision record: Codex skips a hook whose definition changed until the owner trusts it.
const eventRows: readonly EventRow[] = [
  { event: 'SessionStart', matcher: null, timeoutSeconds: 5, harnesses: ['claude', 'codex'] },
  { event: 'PreToolUse', matcher: null, timeoutSeconds: 3, harnesses: ['claude', 'codex'] },
  { event: 'PostToolUse', matcher: 'Bash', timeoutSeconds: 5, harnesses: ['claude', 'codex'] },
  { event: 'PostToolUseFailure', matcher: 'Bash', timeoutSeconds: 5, harnesses: ['claude'] },
  { event: 'SubagentStart', matcher: null, timeoutSeconds: 5, harnesses: ['claude', 'codex'] },
  { event: 'Stop', matcher: null, timeoutSeconds: 3, harnesses: ['claude', 'codex'] },
];

// The six entries of Claude Code or the five of Codex, each running the binary at `bin`.
export function buildHookEntries(harness: Harness, bin: string): readonly HookEntry[] {
  return eventRows
    .filter((row) => row.harnesses.includes(harness))
    .map((row) => ({
      event: row.event,
      matcher: row.matcher,
      timeoutSeconds: row.timeoutSeconds,
      command: `${quoteShellWord(bin)} hook ${harness}`,
    }));
}
