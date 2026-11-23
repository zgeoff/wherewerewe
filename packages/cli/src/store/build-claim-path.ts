import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { LockFileState } from './types.ts';

// The claim file that gives the right to remove the one file at `path` that `seen` names. A claim
// on a claim has a name of the same length, so a chain of crashed claimers never outgrows a name.
export function buildClaimPath(path: string, seen: LockFileState): string {
  const name = basename(path);

  const digest = createHash('sha256')
    .update(`${name}\n${String(seen.ino)}\n${seen.content}`)
    .digest('hex')
    .slice(0, 16);

  return join(dirname(path), `${name.split('.claim-')[0] ?? name}.claim-${digest}`);
}
