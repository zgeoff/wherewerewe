import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import type { CommandResult, Refusal, RunLine } from '../types.ts';

// A refused install: exit 3, the lines on stderr, then each Run line, the last of them saying that
// nothing was written.
export function refuseInstall(
  cwd: string,
  lines: readonly string[],
  runs: readonly RunLine[],
): CommandResult {
  const refusal: Refusal = { exitCode: 3, lines, runs };

  return buildRefusalResult(refusal, { sessionFlag: null, cwd, writes: true });
}
