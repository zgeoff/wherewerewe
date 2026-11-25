import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

// The PATH a probe finds git and gh on, and hands them: each entry of the caller's PATH that is
// absolute and outside the folder the command runs in, compared by real path, so neither a program
// an agent writes into its workspace nor a link to one ever runs from a probe.
export function readProbePath(path: string, cwd: string): string {
  const folder = readRealPath(cwd);

  return path
    .split(':')
    .filter((entry) => entry !== '' && isAbsolute(entry) && !isInside(readRealPath(entry), folder))
    .join(':');
}

// A path that does not exist keeps its lexical form: nothing can run from it.
function readRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function isInside(entry: string, folder: string): boolean {
  const fromFolder = relative(folder, entry);

  return (
    fromFolder === '' ||
    (fromFolder !== '..' && !fromFolder.startsWith('../') && !isAbsolute(fromFolder))
  );
}
