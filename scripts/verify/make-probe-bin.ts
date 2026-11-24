import { lstatSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

// Makes `<run>/bin` with one link, `git`, to the git that this machine has, and returns the folder.
// It does nothing when the link exists. The folder is the whole PATH of `www` in a journey, so a
// probe finds git and never gh, and no journey touches the network.
export function makeProbeBin(stateRoot: string): string {
  const bin = join(stateRoot, 'bin');
  const link = join(bin, 'git');
  const git = Bun.which('git');

  mkdirSync(bin, { recursive: true });

  if (git !== null && !probeEntry(link)) {
    symlinkSync(git, link);
  }

  return bin;
}

function probeEntry(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}
