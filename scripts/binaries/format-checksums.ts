export interface ChecksumEntry {
  readonly name: string;
  readonly sha256: string;
}

// The lines of `shasum -a 256 <names>`: the hash, two spaces, the name, in name order.
export function formatChecksums(entries: readonly ChecksumEntry[]): string {
  return entries
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .map((entry) => `${entry.sha256}  ${entry.name}\n`)
    .join('');
}
