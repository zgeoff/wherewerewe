import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';

// The folder `<run>/paths`, as the file system holds it. A `paths` that is a link, or a run folder
// that resolves elsewhere, is a usage error, so no command here makes or removes a path outside
// the run.
export function resolvePathsFolder(stateRoot: string): string {
  const folder = join(realpathSync(stateRoot), 'paths');

  try {
    if (!lstatSync(folder).isDirectory()) {
      throw new WringerError('usage', {
        message:
          'The paths entry of this run is not a folder of its own, so no path is made or removed.',
      });
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return folder;
    }

    throw error;
  }

  return folder;
}
