import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Makes `<run>/bin`, the whole PATH of `www` in a journey, with one link, `git`, so a probe never
// finds gh. It links to a folder under the system temp folder, one per run, because a probe skips a
// PATH entry whose real path is in a work tree, and the run sits in the repo's.
export function makeProbeBin(stateRoot: string): string {
  const bin = join(stateRoot, 'bin');
  const run = createHash('sha256').update(realpathSync(stateRoot)).digest('hex').slice(0, 16);
  const outside = join(tmpdir(), 'wherewerewe-verify', run, 'bin');
  const link = join(outside, 'git');
  const git = Bun.which('git');

  mkdirSync(outside, { recursive: true });

  if (!probeEntry(bin)) {
    symlinkSync(outside, bin);
  }

  if (git !== null && !probeEntry(link)) {
    symlinkSync(git, link);
  }

  return bin;
}

function probeEntry(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}
