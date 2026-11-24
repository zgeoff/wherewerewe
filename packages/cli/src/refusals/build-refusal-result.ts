import type { CLIResult, Refusal } from '../types.ts';
import { formatRefusal } from './format-refusal.ts';
import type { RefusalScope } from './format-refusal.ts';
import { settleRefusal } from './settle-refusal.ts';

// The result of a refused command: its settled refusal on stderr, with that refusal's exit code.
export function buildRefusalResult(refusal: Refusal, scope: RefusalScope): CLIResult {
  const settled = settleRefusal(refusal, scope);

  return { exitCode: settled.exitCode, stdout: '', stderr: formatRefusal(settled, scope) };
}
