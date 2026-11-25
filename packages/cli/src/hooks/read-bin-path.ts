import { readSafeProgram } from '../install/read-safe-program.ts';

// The path of the `wherewerewe` binary that `command -v` would print, never resolved, so a link
// that an upgrade keeps in place stays the path a hook entry names. `null` when none is on the PATH.
export function readBinPath(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string | null {
  return readSafeProgram('wherewerewe', env, cwd);
}
