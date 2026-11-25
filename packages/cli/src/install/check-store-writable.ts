import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks that this shell can write the store root, by writing and removing a probe file there.
export function checkStoreWritable(storeRoot: string): DoctorCheck {
  const probe = join(storeRoot, `.doctor-probe-${String(process.pid)}`);

  try {
    mkdirSync(storeRoot, { recursive: true });
    writeFileSync(probe, '');
    rmSync(probe, { force: true });
  } catch {
    return buildFailedCheck([
      `www doctor: this shell cannot write the store root ${storeRoot}.`,
      `Run: mkdir -p ${storeRoot}`,
    ]);
  }

  return { isOk: true, lines: [`ok: this shell can write the store root ${storeRoot}`] };
}
