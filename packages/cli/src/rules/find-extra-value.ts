// The value of a key in a journal row's extra, which holds key=value pairs joined by ';'.
export function findExtraValue(extra: string | null, key: string): string | null {
  const prefix = `${key}=`;
  const pair = extra?.split(';').find((candidate) => candidate.startsWith(prefix));

  return pair === undefined ? null : pair.slice(prefix.length);
}
