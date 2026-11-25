import { existsSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import type { Env } from '../types.ts';

// The path a hook entry runs: the first wherewerewe on PATH, as PATH names it. A link is kept as
// it is, because Homebrew's link stays put across upgrades and the file behind it moves.
export function readBinaryPath(env: Env, execPath: string): string {
  const folders = (env['PATH'] ?? '').split(':').filter((folder) => isAbsolute(folder));

  const found = folders
    .map((folder) => join(folder, 'wherewerewe'))
    .find((path) => existsSync(path));

  if (found !== undefined) {
    return found;
  }

  // run from source, the command on PATH stands in
  return basename(execPath).startsWith('wherewerewe') ? execPath : 'wherewerewe';
}
