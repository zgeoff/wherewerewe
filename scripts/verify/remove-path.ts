import { existsSync, lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';
import { checkPathName } from './check-path-name.ts';
import { resolvePathsFolder } from './resolve-paths-folder.ts';

// Removes the folder `<run>/paths/<name>` that `makePath` made, and returns it. A folder that is
// missing, one that `makePath` did not make and a link are each a usage error: never remove a
// path this run did not create.
export function removePath(stateRoot: string, name: string): string {
  checkPathName(name);

  const parent = resolvePathsFolder(stateRoot);
  const folder = join(stateRoot, 'paths', name);
  const marker = join(parent, `.made-${name}`);

  if (!existsSync(folder)) {
    throw new WringerError('usage', {
      message: `The path ${name} is missing in this run, so there is nothing to remove.`,
    });
  }

  if (!existsSync(marker) || !lstatSync(join(parent, name)).isDirectory()) {
    throw new WringerError('usage', {
      message: `The path ${name} was not made by \`www make-path\` in this run, so it is not removed.`,
    });
  }

  rmSync(join(parent, name), { recursive: true });
  rmSync(marker);

  return folder;
}
