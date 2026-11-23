import { buildBriefInput } from '../brief/build-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import type { CLIResult, Store } from '../types.ts';

// Prints the brief. This slice runs no check and saves nothing, so it takes no lock.
export function runBriefCommand(store: Store, nowMs: number): CLIResult {
  return { exitCode: 0, stdout: renderBrief(buildBriefInput(store, nowMs)), stderr: '' };
}
