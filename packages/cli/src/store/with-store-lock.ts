import { join } from 'node:path';
import { createLockFiles } from './create-lock-files.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import type { LockAttempt } from './take-store-lock.ts';
import { takeStoreLock } from './take-store-lock.ts';
import type { LockFiles } from './types.ts';

export type LockResult<Value> =
  | { readonly kind: 'ran'; readonly value: Value }
  | { readonly kind: 'busy'; readonly pid: number | null };

// The lock is a file that exists only while a write runs and holds pid=<n> ts=<iso>, so the
// design fixes its shape and a library file lock cannot give it.
export async function withStoreLock<Value>(
  folder: string,
  fn: () => Promise<Value>,
  options: { readonly waitMs?: number; readonly files?: LockFiles } = {},
): Promise<LockResult<Value>> {
  const files = options.files ?? createLockFiles();
  const lockPath = join(folder, 'lock');

  const attempt = await waitForLock(lockPath, files, Date.now() + (options.waitMs ?? 2000));

  if (attempt.kind === 'held') {
    return { kind: 'busy', pid: attempt.pid };
  }

  try {
    return { kind: 'ran', value: await fn() };
  } finally {
    removeLockIfUnchanged(lockPath, attempt.lock, files, Date.now);
  }
}

const pollMs = 25;

async function waitForLock(
  lockPath: string,
  files: LockFiles,
  deadlineMs: number,
): Promise<LockAttempt> {
  for (;;) {
    const attempt = takeStoreLock(lockPath, files, Date.now);

    if (attempt.kind === 'taken' || Date.now() >= deadlineMs) {
      return attempt;
    }

    await Bun.sleep(pollMs);
  }
}
