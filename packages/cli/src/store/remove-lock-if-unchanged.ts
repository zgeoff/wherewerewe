import { buildClaimPath } from './build-claim-path.ts';
import { parseLockLine } from './parse-lock-line.ts';
import { probeProcess } from './probe-process.ts';
import type { LockFileState, LockFiles } from './types.ts';

export type LockRemoval = 'removed' | 'changed' | 'claimed';

// Two writers are never inside at once: a lock or claim file is removed only by its living creator
// or by the one caller that won the claim named after that file and re-read it under the claim, and
// a new lock needs the path empty, so the file cannot change between that re-read and the removal.
export function removeLockIfUnchanged(
  path: string,
  seen: LockFileState,
  files: LockFiles,
): LockRemoval {
  const claimPath = buildClaimPath(path, seen);

  if (!takeClaim(claimPath, files)) {
    return 'claimed';
  }

  try {
    const current = files.read(path);

    if (current === null || current.ino !== seen.ino || current.content !== seen.content) {
      return 'changed';
    }

    files.remove(path);

    return 'removed';
  } finally {
    files.remove(claimPath);
  }
}

// A claim's holder counts as dead by its pid alone, never by age: a paused holder that woke after
// an age-based takeover would remove a lock that is live by then. A dead holder's claim is removed
// under a claim of its own, since two writers can judge it dead at once.
function takeClaim(claimPath: string, files: LockFiles): boolean {
  for (;;) {
    const line = `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`;

    if (files.create(claimPath, line) !== null) {
      return true;
    }

    const holder = files.read(claimPath);

    if (holder !== null && probeHolder(holder.content)) {
      return false;
    }

    if (holder !== null && removeLockIfUnchanged(claimPath, holder, files) === 'claimed') {
      return false;
    }
  }
}

function probeHolder(content: string): boolean {
  const line = parseLockLine(content);

  return line !== null && probeProcess(line.pid);
}
