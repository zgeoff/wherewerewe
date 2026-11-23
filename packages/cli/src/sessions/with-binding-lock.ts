import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { LockResult } from '../store/with-store-lock.ts';
import { withStoreLock } from '../store/with-store-lock.ts';

// Every change to a binding, an attach, a detach or an init, runs under this one lock, and so does
// the check that the binding is still what the change meant to replace. The lock is a file in the
// bindings folder, which holds one file per agent session and no other file of that name.
export async function withBindingLock<Value>(
  root: string,
  fn: () => Promise<Value>,
): Promise<LockResult<Value>> {
  const folder = join(root, '.bindings');

  await mkdir(folder, { recursive: true });

  return withStoreLock(folder, fn, { waitMs: 2000 });
}
