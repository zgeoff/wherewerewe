import type { CLIInput } from '../types.ts';
import { isSetVariable } from './is-set-variable.ts';

export const agentVariables = [
  'CLAUDECODE',
  'CLAUDE_CODE_SESSION_ID',
  'CODEX_SESSION_ID',
  'CODEX_THREAD_ID',
  'CODEX_CI',
] as const;

// True only when stdin and stdout are terminals and no agent variable has a value.
export function isOwnerTerminal(input: Pick<CLIInput, 'env' | 'terminal'>): boolean {
  return (
    input.terminal.stdin &&
    input.terminal.stdout &&
    !agentVariables.some((name) => isSetVariable(input.env[name]))
  );
}
