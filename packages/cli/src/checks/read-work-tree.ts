import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The real path of the work tree that holds a folder: the nearest folder, the folder itself
// included, that holds an entry named `.git`. It runs no git. `null` when no folder up to the root
// holds one. A folder that does not exist is read from its nearest folder that does.
export function readWorkTree(folder: string): string | null {
  let current = readNearestRealPath(folder);

  for (;;) {
    if (existsSync(join(current, '.git'))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

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
