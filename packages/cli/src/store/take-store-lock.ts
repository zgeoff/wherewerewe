import { parseLockLine } from './parse-lock-line.ts';
import { probeProcess } from './probe-process.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import type { LockFileState, LockFiles } from './types.ts';

export type LockAttempt =
  | { readonly kind: 'taken'; readonly lock: LockFileState }
  | { readonly kind: 'held'; readonly pid: number | null };

// Each lock line this process writes at a path has a later ts than the last, even when the clock
// goes back, so a writer that saw an earlier lock of this process never matches a later one.
const lastTsMsByPath = new Map<string, number>();

const staleMs = 30_000;

// One try at the lock: create it, or, when the lock there is stale or just went, remove that one
// lock and create it again.
export function takeStoreLock(lockPath: string, files: LockFiles, now: () => number): LockAttempt {
  const tsMs = Math.max(now(), (lastTsMsByPath.get(lockPath) ?? 0) + 1);

  lastTsMsByPath.set(lockPath, tsMs);

  const attempt = createOrTakeOver(
    lockPath,
    files,
    `pid=${String(process.pid)} ts=${new Date(tsMs).toISOString()}\n`,
    now,
  );

  if (attempt.kind === 'held' || now() - tsMs <= staleMs) {
    return attempt;
  }

  // A writer paused between writing its ts and making the lock made a lock that any other writer
  // may take over at once, so it gives that lock up.
  removeLockIfUnchanged(lockPath, attempt.lock, files);

  return { kind: 'held', pid: null };
}

function createOrTakeOver(
  lockPath: string,
  files: LockFiles,
  line: string,
  now: () => number,
): LockAttempt {
  const created = files.create(lockPath, line);

  if (created !== null) {
    return { kind: 'taken', lock: created };
  }

  const holder = files.read(lockPath);

  if (
    holder !== null &&
    (!probeStale(holder, now()) || removeLockIfUnchanged(lockPath, holder, files) !== 'removed')
  ) {
    return { kind: 'held', pid: parseLockLine(holder.content)?.pid ?? null };
  }

  const retaken = files.create(lockPath, line);

  return retaken === null ? { kind: 'held', pid: null } : { kind: 'taken', lock: retaken };
}

// A file that does not parse was made by hand, so only its age can say that nobody holds it.
function probeStale(holder: LockFileState, nowMs: number): boolean {
  const line = parseLockLine(holder.content);

  if (line === null) {
    return nowMs - holder.mtimeMs > staleMs;
  }

  return nowMs - line.tsMs > staleMs || !probeProcess(line.pid);
}
