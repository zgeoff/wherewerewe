import { buildReleaseTag } from './build-release-tag.ts';

// The reason a ship step must not run, or null when the run is at the tag of the package's own
// version. A run on main or on another tag would otherwise overwrite the assets of a release or
// push a formula for a version it never built.
export function findRefRefusal(githubRef: string | undefined, version: string): string | null {
  const expected = `refs/tags/${buildReleaseTag(version)}`;

  return githubRef === expected
    ? null
    : `the run is at ${githubRef ?? 'no ref'}, and a ship runs only at ${expected}`;
}
