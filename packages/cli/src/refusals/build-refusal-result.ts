import type { CLIResult, Refusal } from '../types.ts';
import { formatRefusal } from './format-refusal.ts';
import { settleRefusal } from './settle-refusal.ts';
import type { RunScope } from './settle-refusal.ts';

// The result of a refused command: its settled refusal on stderr, with that refusal's exit code.
export function buildRefusalResult(refusal: Refusal, scope: RunScope): CLIResult {
  const settled = settleRefusal(refusal, scope);

  return {
    exitCode: settled.refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(settled.refusal, settled.scope),
  };
}
