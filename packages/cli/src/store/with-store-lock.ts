import { randomBytes } from 'node:crypto';
import {
  closeSync,
  linkSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
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
    removeOwn(lockPath, mine);
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

// Of two writers that judge one lock stale, only one wins the rename: the other gets ENOENT.
// When the renamed file differs from the one judged stale, a new holder took the lock in between,
// so it goes back. Returns whether the stale lock is gone.
function takeOver(lockPath: string, judgedContent: string): boolean {
  const renamedPath = `${lockPath}.stale-${String(process.pid)}-${randomBytes(4).toString('hex')}`;

  try {
    renameSync(lockPath, renamedPath);
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return true;
    }

    throw error;
  }

  const renamedContent = readFileSync(renamedPath, 'utf8');
  const isSame = renamedContent === judgedContent;

  if (!isSame) {
    try {
      linkSync(renamedPath, lockPath);
    } catch (error) {
      if (!isErrorCode(error, 'EEXIST')) {
        throw error;
      }
    }
  }

  unlinkSync(renamedPath);

  return isSame;
}

function removeOwn(lockPath: string, mine: string): void {
  try {
    if (readFileSync(lockPath, 'utf8') === mine) {
      unlinkSync(lockPath);
    }
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}
