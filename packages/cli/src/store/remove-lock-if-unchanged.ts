import { buildClaimPath } from './build-claim-path.ts';
import { staleLockMs } from './constants.ts';
import { isSameLockFile } from './is-same-lock-file.ts';
import { parseLockLine } from './parse-lock-line.ts';
import { pickLiveness } from './pick-liveness.ts';
import type { LockFileState, LockFiles } from './types.ts';

export type LockRemoval = 'removed' | 'changed' | 'claimed';

// A lock or claim file is removed only by its living creator or by the one caller that won the
// claim named after that file and re-read it under the claim, and a new lock needs the path empty,
// so the file cannot change between that re-read and the removal while the claim holds.
export function removeLockIfUnchanged(
  path: string,
  seen: LockFileState,
  files: LockFiles,
  now: () => number,
): LockRemoval {
  const claimPath = buildClaimPath(path, seen);
  const claim = takeClaim(claimPath, files, now);

  if (claim === null) {
    return 'claimed';
  }

  try {
    if (!isSameLockFile(files.read(path), seen)) {
      return 'changed';
    }

    if (!probeClaimHeld(claimPath, claim, files, now)) {
      return 'claimed';
    }

    files.remove(path);

    return 'removed';
  } finally {
    if (isSameLockFile(files.read(claimPath), claim.file)) {
      files.remove(claimPath);
    }
  }
}

interface Claim {
  readonly file: LockFileState;
  readonly tsMs: number;
}

// Another caller removes the claim of a dead holder at once, and of a holder whose liveness is
// unknown once the claim is past the stale age, so a crashed claimer never blocks the store for good.
// A holder that is alive by its pid and start time keeps its claim however old it grows.
function takeClaim(claimPath: string, files: LockFiles, now: () => number): Claim | null {
  const own = files.readProcess(process.pid);
  const start = own.kind === 'running' ? own.start : null;

  for (;;) {
    const tsMs = now();
    const line = `pid=${String(process.pid)} ts=${new Date(tsMs).toISOString()}${start === null ? '' : ` start=${start}`}\n`;
    const created = files.create(claimPath, line);

    if (created !== null) {
      return { file: created, tsMs };
    }

    const holder = files.read(claimPath);

    if (holder !== null && !probeClaimReapable(holder, files, now())) {
      return null;
    }

    if (holder !== null && removeLockIfUnchanged(claimPath, holder, files, now) === 'claimed') {
      return null;
    }
  }
}

// A claim file that does not parse was made by hand, as no caller writes one.
function probeClaimReapable(holder: LockFileState, files: LockFiles, nowMs: number): boolean {
  const line = parseLockLine(holder.content);

  if (line === null) {
    return true;
  }

  const liveness = pickLiveness(line, files.readProcess(line.pid));

  return liveness === 'dead' || (liveness === 'unknown' && nowMs - line.tsMs > staleLockMs);
}

// A holder removes nothing once its claim is gone or past the stale age, so two writers are inside
// at once only when a holder pauses past the stale age between this check and its removal, the
// limit the lock's own stale age sets.
function probeClaimHeld(
  claimPath: string,
  claim: Claim,
  files: LockFiles,
  now: () => number,
): boolean {
  const current = files.read(claimPath);

  return isSameLockFile(current, claim.file) && now() - claim.tsMs <= staleLockMs;
}
