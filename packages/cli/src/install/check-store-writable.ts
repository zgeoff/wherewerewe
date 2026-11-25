import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks that this shell can write the store root, by making and removing a probe file there. The
// file takes a name no one can guess and must not exist, so a link planted at it is never followed.
export function checkStoreWritable(storeRoot: string): DoctorCheck {
  const probe = join(storeRoot, `.doctor-probe-${randomBytes(8).toString('hex')}`);

  try {
    mkdirSync(storeRoot, { recursive: true });
    writeFileSync(probe, '', { flag: 'wx' });
    rmSync(probe, { force: true });
  } catch {
    return buildFailedCheck([
      `www doctor: this shell cannot write the store root ${storeRoot}.`,
      `Run: mkdir -p ${storeRoot}`,
    ]);
  }

  return { isOk: true, lines: [`ok: this shell can write the store root ${storeRoot}`] };
}
