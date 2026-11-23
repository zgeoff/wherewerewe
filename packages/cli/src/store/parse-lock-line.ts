export interface LockLine {
  readonly pid: number;
  readonly tsMs: number;
  readonly start: string | null;
}

// A lock file holds `pid=<n> ts=<iso>`, and a claim file can add ` start=<process start>`; null
// for anything else.
export function parseLockLine(content: string): LockLine | null {
  const match = /^pid=(?<pid>[1-9]\d*) ts=(?<ts>\S+)(?: start=(?<start>\d+))?\n?$/u.exec(content);
  const tsMs = Date.parse(match?.groups?.['ts'] ?? '');

  if (match === null || Number.isNaN(tsMs)) {
    return null;
  }

  return { pid: Number(match.groups?.['pid']), tsMs, start: match.groups?.['start'] ?? null };
}
