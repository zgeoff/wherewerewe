export function findExtraValue(extra: string | null, key: string): string | null {
  const prefix = `${key}=`;
  const pair = extra?.split(';').find((candidate) => candidate.startsWith(prefix));

  return pair === undefined ? null : pair.slice(prefix.length);
}
