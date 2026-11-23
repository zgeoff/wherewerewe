import { createHash } from 'node:crypto';
import type { LockFileState } from './types.ts';

// The claim file that gives the right to remove the one file at `path` that `seen` names.
export function buildClaimPath(path: string, seen: LockFileState): string {
  const digest = createHash('sha256').update(seen.content).digest('hex').slice(0, 12);

  return `${path}.claim-${String(seen.ino)}-${digest}`;
}
