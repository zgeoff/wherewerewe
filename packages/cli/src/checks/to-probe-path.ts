import { isAbsolute, relative, resolve } from 'node:path';

// The PATH a probe finds git and gh on: each entry of the caller's PATH that is absolute and
// outside the folder the command runs in, so a program an agent writes into its workspace never
// runs from a probe.
export function toProbePath(path: string, cwd: string): string {
  return path
    .split(':')
    .filter((entry) => entry !== '' && isAbsolute(entry) && !isInside(entry, cwd))
    .join(':');
}

function isInside(entry: string, folder: string): boolean {
  const fromFolder = relative(resolve(folder), resolve(entry));

  return (
    fromFolder === '' ||
    (fromFolder !== '..' && !fromFolder.startsWith('../') && !isAbsolute(fromFolder))
  );
}
