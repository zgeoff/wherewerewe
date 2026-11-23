import { parseLockLine } from './parse-lock-line.ts';
import { probeProcess } from './probe-process.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import type { LockFileState, LockFiles } from './types.ts';

export type LockAttempt =
  | { readonly kind: 'taken'; readonly lock: LockFileState }
  | { readonly kind: 'held'; readonly pid: number | null };

// One try at the lock: create it, or, when the lock there is stale or just went, remove that one
// lock and create it again.
export function takeStoreLock(lockPath: string, files: LockFiles, nowMs: number): LockAttempt {
  const line = `pid=${String(process.pid)} ts=${new Date(nowMs).toISOString()}\n`;
  const created = files.create(lockPath, line);

  if (created !== null) {
    return { kind: 'taken', lock: created };
  }

  const holder = files.read(lockPath);

  if (
    holder !== null &&
    (!probeStale(holder, nowMs) || removeLockIfUnchanged(lockPath, holder, files) !== 'removed')
  ) {
    return { kind: 'held', pid: parseLockLine(holder.content)?.pid ?? null };
  }

  const retaken = files.create(lockPath, line);

  return retaken === null ? { kind: 'held', pid: null } : { kind: 'taken', lock: retaken };
}

const staleMs = 30_000;

// A file that does not parse was made by hand, so only its age can say that nobody holds it.
function probeStale(holder: LockFileState, nowMs: number): boolean {
  const line = parseLockLine(holder.content);

  if (line === null) {
    return nowMs - holder.mtimeMs > staleMs;
  }

  return nowMs - line.tsMs > staleMs || !probeProcess(line.pid);
}
