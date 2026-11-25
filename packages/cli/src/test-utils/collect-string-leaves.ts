// The path of each string in a parsed JSON value that `isKept` keeps, every string by default,
// joined with dots, each array index written as `[]`, so the rows of one array share a path.
export function collectStringLeaves(
  value: unknown,
  path: readonly string[] = [],
  isKept: (text: string) => boolean = () => true,
): string[] {
  if (typeof value === 'string') {
    return isKept(value) ? [path.join('.')] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown) => collectStringLeaves(entry, [...path, '[]'], isKept));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectStringLeaves(entry, [...path, key], isKept),
    );
  }

  return [];
}
