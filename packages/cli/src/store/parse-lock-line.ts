export interface LockLine {
  readonly pid: number;
  readonly tsMs: number;
}

// A lock or claim file holds `pid=<n> ts=<iso>` and a newline; null for anything else.
export function parseLockLine(content: string): LockLine | null {
  const match = /^pid=(?<pid>[1-9]\d*) ts=(?<ts>\S+)\n$/u.exec(content);
  const tsMs = Date.parse(match?.groups?.['ts'] ?? '');

  if (match === null || Number.isNaN(tsMs)) {
    return null;
  }

  return { pid: Number(match.groups?.['pid']), tsMs };
}
