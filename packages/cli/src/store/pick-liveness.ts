import type { LockLine } from './parse-lock-line.ts';
import type { ProcessState } from './types.ts';

export type Liveness = 'alive' | 'dead' | 'unknown';

// A holder is alive only when its pid runs with the start time its line records, and dead only when
// no process has its pid. A line with no start, or a start the system cannot show or that differs,
// cannot tell the holder from a later process with its pid.
export function pickLiveness(line: LockLine, process: ProcessState): Liveness {
  if (process.kind === 'gone') {
    return 'dead';
  }

  return line.start !== null && process.start === line.start ? 'alive' : 'unknown';
}
