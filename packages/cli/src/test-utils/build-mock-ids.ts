// Distinct item ids of 16 characters, the longest an id may be: the prefix, a two-digit number,
// then x to fill.
export function buildMockIDs(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_unused, index) =>
    `${prefix}${String(index + 1).padStart(2, '0')}`.padEnd(16, 'x'),
  );
}
