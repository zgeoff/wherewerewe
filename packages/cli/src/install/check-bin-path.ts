import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks that a wherewerewe is on the PATH, since each hook entry runs it by its path.
export function checkBinPath(bin: string | null): DoctorCheck {
  if (bin === null) {
    return buildFailedCheck([
      'www doctor: no wherewerewe is on PATH, and each hook entry runs it by its path.',
      'Run: brew install zgeoff/tap/wherewerewe',
    ]);
  }

  return { isOk: true, lines: [`ok: wherewerewe is on PATH at ${bin}`] };
}
