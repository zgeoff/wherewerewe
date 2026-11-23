// The paths whose hash differs between two tree reads, or that exist in only one of them, sorted.
export function readChangedPaths(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): string[] {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);

  return [...paths].filter((path) => before[path] !== after[path]).toSorted();
}
