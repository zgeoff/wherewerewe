import { briefFooter } from '../brief/join-brief.ts';
import { readShellCommand } from './read-shell-command.ts';
import type { HookInput } from './types.ts';

export type BriefEnd = 'whole' | 'cut' | 'failed';

// Sorts the end of a brief command by "What counts as a whole read". Null for a payload that is not
// the end of the main agent's brief command: one with `agent_id`, a tool other than Bash, or a
// command that is not the brief command.
export function sortBriefEnd(input: HookInput, bound: string): BriefEnd | null {
  if (
    (input.event !== 'PostToolUse' && input.event !== 'PostToolUseFailure') ||
    input.agentID !== null ||
    input.toolName !== 'Bash' ||
    readShellCommand(input.command, bound, input.harness) !== 'brief-command'
  ) {
    return null;
  }

  if (input.event === 'PostToolUseFailure' || (input.exitCode !== null && input.exitCode !== 0)) {
    return 'failed';
  }

  const output = input.response;
  const isHeaderRight = output.startsWith(`${bound} · day`);
  const isFooterRight = output.replace(/\n$/u, '').endsWith(briefFooter);

  if (!isHeaderRight || !isFooterRight) {
    return 'failed';
  }

  const hasMarker = output.includes('<persisted-output>') || output.includes('tokens truncated');

  const isOverCap =
    input.harness === 'codex' &&
    input.maxOutputTokens !== null &&
    input.maxOutputTokens * 4 < Buffer.byteLength(output, 'utf8');

  if (!hasMarker && !isOverCap) {
    return 'whole';
  }

  return input.harness === 'codex' ? 'cut' : 'failed';
}
