import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The real path of the outermost work tree that holds a folder: the highest folder, the folder
// itself included, that holds an entry named `.git`. It runs no git, and an agent's nested `.git`
// cannot shrink it. `null` when no folder up to the root holds one.
export function readWorkTree(folder: string): string | null {
  let current = readNearestRealPath(folder);
  let found: string | null = null;

  for (;;) {
    if (existsSync(join(current, '.git'))) {
      found = current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return found;
    }

    current = parent;
  }
}

// A folder that does not exist is read from its nearest folder that does.
function readNearestRealPath(folder: string): string {
  let current = resolve(folder);

  for (;;) {
    try {
      return realpathSync(current);
    } catch {
      const parent = dirname(current);

      if (parent === current) {
        return current;
      }

      current = parent;
    }
  }
}
