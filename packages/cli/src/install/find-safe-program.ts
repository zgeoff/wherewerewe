import { realpathSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';

// Finds a program on the PATH of `env`, as `Bun.which` does, after it drops each entry that a repo
// can plant a program in: an empty or a relative entry, and a folder at or under the working
// folder, by its name or by where a link points. It runs nothing, and keeps the path as found.
export function findSafeProgram(
  name: string,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string | null {
  const entries = (env['PATH'] ?? '')
    .split(':')
    .filter(
      (entry) => isAbsolute(entry) && !isUnder(entry, cwd) && !isUnder(resolveEntry(entry), cwd),
    );

  return Bun.which(name, { PATH: entries.join(':'), cwd: '/' });
}

function isUnder(folder: string, cwd: string): boolean {
  const prefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;

  return folder === cwd || folder.startsWith(prefix);
}

function resolveEntry(entry: string): string {
  try {
    return realpathSync(entry);
  } catch {
    return entry;
  }
}
