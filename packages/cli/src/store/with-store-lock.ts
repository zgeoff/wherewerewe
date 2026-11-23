import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';

export type LockResult<Value> =
  | { readonly kind: 'ran'; readonly value: Value }
  | { readonly kind: 'busy'; readonly pid: number | null };

const pollMs = 25;

// The lock is a file that exists only while a write runs and holds pid=<n> ts=<iso>, so the
// design fixes its shape and a library file lock cannot give it.
export async function withStoreLock<Value>(
  folder: string,
  fn: () => Promise<Value>,
  options: { readonly waitMs?: number } = {},
): Promise<LockResult<Value>> {
  const lockPath = join(folder, 'lock');
  const mine = `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`;
  const deadlineMs = Date.now() + (options.waitMs ?? 2000);

  for (;;) {
    if (tryCreate(lockPath, mine)) {
      break;
    }

    const holder = readHolder(lockPath);

    if (holder !== null && holder.isStale && takeOver(lockPath, holder.content)) {
      continue;
    }

    if (holder !== null && Date.now() >= deadlineMs) {
      return { kind: 'busy', pid: holder.pid };
    }

    await Bun.sleep(pollMs);
  }

  try {
    return { kind: 'ran', value: await fn() };
  } finally {
    await removeOwn(lockPath, mine);
  }
}

function tryCreate(lockPath: string, content: string): boolean {
  try {
    const handle = openSync(lockPath, 'wx');

    try {
      writeSync(handle, content);
    } finally {
      closeSync(handle);
    }

    return true;
  } catch (error) {
    if (isErrorCode(error, 'EEXIST')) {
      return false;
    }

    throw error;
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

const staleMs = 30_000;

interface Holder {
  readonly content: string;
  readonly pid: number | null;
  readonly isStale: boolean;
}

function readHolder(lockPath: string): Holder | null {
  try {
    const content = readFileSync(lockPath, 'utf8');
    const match = /^pid=(?<pid>\d+) ts=(?<ts>\S+)\n?$/u.exec(content);

    if (match === null) {
      return {
        content,
        pid: null,
        isStale: Date.now() - statSync(lockPath).mtimeMs > staleMs,
      };
    }

    const pid = Number(match.groups?.['pid']);
    const isOld = Date.now() - Date.parse(match.groups?.['ts'] ?? '') > staleMs;

    return { content, pid, isStale: isOld || !isAlive(pid) };
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return !isErrorCode(error, 'ESRCH');
  }
}

// Removes the lock that was judged stale, when it is still that one. Returns whether the lock is
// gone or was replaced, so the caller tries to create it again; false means the guard is taken.
function takeOver(lockPath: string, judgedContent: string): boolean {
  return runGuarded(lockPath, () => {
    if (readIfThere(lockPath) === judgedContent) {
      unlinkIfThere(lockPath);
    }
  });
}

// Only the guard's holder removes the lock, a takeover or the holder at its end, and it re-reads
// the lock first, so nobody removes a lock that replaced the one it meant to. The guarded code
// awaits nothing, so a guard older than the stale age is a crash. Returns whether it ran.
function runGuarded(lockPath: string, fn: () => void): boolean {
  const guardPath = `${lockPath}.guard`;

  if (!tryCreate(guardPath, `pid=${String(process.pid)}\n`)) {
    removeCrashedGuard(guardPath);

    return false;
  }

  try {
    fn();

    return true;
  } finally {
    unlinkIfThere(guardPath);
  }
}

function removeCrashedGuard(guardPath: string): void {
  try {
    if (Date.now() - statSync(guardPath).mtimeMs > staleMs) {
      unlinkIfThere(guardPath);
    }
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

function unlinkIfThere(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

function readIfThere(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

const guardPollMs = 5;

async function removeOwn(lockPath: string, mine: string): Promise<void> {
  for (;;) {
    const isRemoved = runGuarded(lockPath, () => {
      if (readIfThere(lockPath) === mine) {
        unlinkIfThere(lockPath);
      }
    });

    if (isRemoved) {
      return;
    }

    await Bun.sleep(guardPollMs);
  }
}
