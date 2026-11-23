import { staleLockMs } from './constants.ts';
import { isSameLockFile } from './is-same-lock-file.ts';
import { parseLockLine } from './parse-lock-line.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import type { LockFileState, LockFiles } from './types.ts';

export type LockAttempt =
  | { readonly kind: 'taken'; readonly lock: LockFileState }
  | { readonly kind: 'held'; readonly pid: number | null };

// Each lock line this process writes at a path has a later ts than the last, even when the clock
// goes back, so a writer that saw an earlier lock of this process never matches a later one.
const lastTsMsByPath = new Map<string, number>();

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

  if (attempt.kind === 'held') {
    return attempt;
  }

  // A writer paused between writing its ts and making the lock made a lock that any other writer
  // may take over at once, so it gives that lock up.
  if (now() - tsMs > staleLockMs) {
    removeLockIfUnchanged(lockPath, attempt.lock, files, now);

    return { kind: 'held', pid: null };
  }

  // A writer that took this lock over while this one paused has replaced it by now.
  return isSameLockFile(files.read(lockPath), attempt.lock) ? attempt : { kind: 'held', pid: null };
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
    (!probeStale(holder, files, now()) ||
      removeLockIfUnchanged(lockPath, holder, files, now) !== 'removed')
  ) {
    return { kind: 'held', pid: parseLockLine(holder.content)?.pid ?? null };
  }

  const retaken = files.create(lockPath, line);

  return retaken === null ? { kind: 'held', pid: null } : { kind: 'taken', lock: retaken };
}

// A file that does not parse was made by hand, so only its age can say that nobody holds it.
function probeStale(holder: LockFileState, files: LockFiles, nowMs: number): boolean {
  const line = parseLockLine(holder.content);

  if (line === null) {
    return nowMs - holder.mtimeMs > staleLockMs;
  }

  return nowMs - line.tsMs > staleLockMs || files.readProcess(line.pid).kind === 'gone';
}
