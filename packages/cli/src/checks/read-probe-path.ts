import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { readWorkTree } from './read-work-tree.ts';

// The PATH a probe finds git and gh on: each absolute entry of the caller's PATH outside the folder
// the command runs in and the work tree of each folder in `trees`, compared by real path, so no
// program an agent writes into its workspace, or links to, ever runs.
export function readProbePath(path: string, cwd: string, trees: readonly string[] = []): string {
  const guarded = readGuardedFolders(cwd, trees);

  return path
    .split(':')
    .filter(
      (entry) =>
        entry !== '' &&
        isAbsolute(entry) &&
        !guarded.some((folder) => isInside(readRealPath(entry), folder)),
    )
    .join(':');
}

// The first program of that name on the probe's PATH whose real path is outside each guarded
// folder, so a link from a trusted folder to a file an agent wrote into a work tree never runs.
export function readProbeProgram(
  name: string,
  probePath: string,
  cwd: string,
  trees: readonly string[] = [],
): string | null {
  const guarded = readGuardedFolders(cwd, trees);

  for (const entry of probePath.split(':')) {
    const found = Bun.which(name, { PATH: entry, cwd: '/' });

    if (found !== null && !guarded.some((folder) => isInside(readRealPath(found), folder))) {
      return found;
    }
  }

  return null;
}

function readGuardedFolders(cwd: string, trees: readonly string[]): string[] {
  const folders = [readRealPath(cwd), ...trees.map((folder) => readWorkTree(folder))];

  return [...new Set(folders.filter((folder): folder is string => folder !== null))];
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
