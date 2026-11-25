// The git tag that release-please gives a release of the package.
export function buildReleaseTag(version: string): string {
  return `@wherewerewe/cli@${version}`;
}
