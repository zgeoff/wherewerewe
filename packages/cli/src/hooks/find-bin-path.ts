import { findSafeProgram } from '../install/find-safe-program.ts';

// The path of the `wherewerewe` binary that `command -v` would print, never resolved, so a link
// that an upgrade keeps in place stays the path a hook entry names. `null` when none is on the PATH.
export function findBinPath(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string | null {
  return findSafeProgram('wherewerewe', env, cwd);
}
