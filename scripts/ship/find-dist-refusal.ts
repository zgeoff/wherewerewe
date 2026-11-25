import { allTargets } from '../binaries/all-targets.ts';
import { formatChecksums } from '../binaries/format-checksums.ts';
import type { ChecksumEntry } from '../binaries/format-checksums.ts';

export interface DistContents {
  // the files of dist/ that start with wherewerewe-, hashed
  readonly binaries: readonly ChecksumEntry[];

  // the text of dist/SHA256SUMS, or null when the file is missing
  readonly checksums: string | null;
}

// The reason dist/ must not go onto a release, or null when it holds the binary of every target and
// a SHA256SUMS that matches them. A partial build would otherwise replace a complete release's
// manifest with one that lacks the other platforms.
export function findDistRefusal(dist: DistContents): string | null {
  const wanted = allTargets.map((target) => `wherewerewe-${target}`).toSorted();
  const found = dist.binaries.map((binary) => binary.name).toSorted();

  if (found.join(' ') !== wanted.join(' ')) {
    return `dist/ holds [${found.join(', ')}], and a release needs exactly [${wanted.join(', ')}]`;
  }

  if (dist.checksums !== formatChecksums(dist.binaries)) {
    return 'dist/SHA256SUMS is missing or does not match the binaries in dist/';
  }

  return null;
}
