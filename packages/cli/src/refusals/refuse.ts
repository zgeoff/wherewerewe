import type { Refusal, RunWord } from '../types.ts';

// A refusal of one line, exit code 3, and the one Run line that fixes it.
export function refuse(line: string, argv: readonly RunWord[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}
