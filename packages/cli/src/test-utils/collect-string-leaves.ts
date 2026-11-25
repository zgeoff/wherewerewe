// The path of each string in a parsed JSON value, joined with dots, each array index written as
// `[]`, so the rows of one array share a path.
export function collectStringLeaves(value: unknown, path: readonly string[] = []): string[] {
  if (typeof value === 'string') {
    return [path.join('.')];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown) => collectStringLeaves(entry, [...path, '[]']));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectStringLeaves(entry, [...path, key]),
    );
  }

  return [];
}
