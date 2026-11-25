import type { DoctorCheck } from './types.ts';

// A failed check: the lines it prints, the failing line first and each fix after it.
export function buildFailedCheck(lines: readonly string[]): DoctorCheck {
  return { isOk: false, lines };
}
