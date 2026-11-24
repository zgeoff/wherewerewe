import { readProcess } from '../store/read-process.ts';
import type { Extra } from '../types.ts';
import type { CheckProbe } from './types.ts';

interface ProcessTarget {
  readonly pid: number;
}

// alive, unless the pid now belongs to another process: its start time differs from the one stored
// with the claim. Where the start time cannot be read, the pid alone decides.
export function probeProcess(target: ProcessTarget, extra: Extra): CheckProbe {
  const state = readProcess(target.pid);

  const isSame =
    state.kind === 'running' &&
    (extra.pid_start === undefined || state.start === null || state.start === extra.pid_start);

  return { result: { kind: 'result', result: isSame ? 'alive' : 'gone' }, failing: [] };
}
