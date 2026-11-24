import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';
import { checkPathName } from './check-path-name.ts';

// Removes the folder `<run>/paths/<name>` that `makePath` made, and returns it. A folder that is
// missing is a usage error, so a journey that removes a path twice fails at the second line.
export function removePath(stateRoot: string, name: string): string {
  checkPathName(name);

  const folder = join(stateRoot, 'paths', name);

  if (!existsSync(folder)) {
    throw new WringerError('usage', {
      message: `The path ${name} is missing in this run, so there is nothing to remove.`,
    });
  }

  rmSync(folder, { recursive: true, force: true });

  return folder;
}
