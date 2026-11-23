import type { LockFileState } from './types.ts';

export function isSameLockFile(current: LockFileState | null, seen: LockFileState): boolean {
  return current !== null && current.ino === seen.ino && current.content === seen.content;
}
