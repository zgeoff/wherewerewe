import { randomUUID } from 'node:crypto';
import { linkSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { isErrorCode } from './is-error-code.ts';

// Removes the lock file when it still holds `expected`. The rename claims the lock under a name
// only this call knows. A lock that holds something else goes back with a link, which fails only
// when a third writer made a lock in between, and then the claimed lock is dropped.
export function removeLockIf(lockPath: string, expected: string): boolean {
  const claimed = `${lockPath}.claim-${String(process.pid)}-${randomUUID()}`;

  try {
    renameSync(lockPath, claimed);
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return false;
    }

    throw error;
  }

  try {
    if (readFileSync(claimed, 'utf8') === expected) {
      return true;
    }

    restoreLock(claimed, lockPath);

    return false;
  } finally {
    unlinkSync(claimed);
  }
}

function restoreLock(claimed: string, lockPath: string): void {
  try {
    linkSync(claimed, lockPath);
  } catch (error) {
    if (!isErrorCode(error, 'EEXIST')) {
      throw error;
    }
  }
}
