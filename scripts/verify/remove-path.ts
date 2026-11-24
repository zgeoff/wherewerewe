import { existsSync, lstatSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WringerError } from '@wringer/core';
import { checkPathName } from './check-path-name.ts';
import { readPathIdentity } from './read-path-identity.ts';
import { resolvePathsFolder } from './resolve-paths-folder.ts';

// Removes the folder `<run>/paths/<name>` that `makePath` made, and returns it. A folder that is
// missing, one that is not the folder `makePath` made, such as a replacement, and a link are each a
// usage error: never remove a path this run did not create.
export function removePath(
  stateRoot: string,
  name: string,
  readIdentity: (path: string) => string = readPathIdentity,
  rename: (from: string, to: string) => void = renameSync,
): string {
  checkPathName(name);

  const parent = resolvePathsFolder(stateRoot);
  const folder = join(stateRoot, 'paths', name);
  const marker = join(parent, `.made-${name}`);

  if (!existsSync(folder)) {
    throw new WringerError('usage', {
      message: `The path ${name} is missing in this run, so there is nothing to remove.`,
    });
  }

  const notMade = new WringerError('usage', {
    message: `The path ${name} was not made by \`www make-path\` in this run, so it is not removed.`,
  });

  if (!probeMadeFolder(join(parent, name), marker, readIdentity)) {
    throw notMade;
  }

  // A folder can take the name between the check and the delete, so the entry first moves to a
  // folder made here, and is deleted only when it is still the one the marker names.
  const holding = mkdtempSync(join(parent, '.removing-'));
  const held = join(holding, name);

  rename(join(parent, name), held);

  if (!probeMadeFolder(held, marker, readIdentity)) {
    setEntryAside(held, rename);
    rmSync(holding, { recursive: true, force: true });
    throw notMade;
  }

  rmSync(holding, { recursive: true });
  rmSync(marker);

  return folder;
}

function probeMadeFolder(
  folder: string,
  marker: string,
  readIdentity: (path: string) => string,
): boolean {
  return (
    existsSync(marker) &&
    lstatSync(folder).isDirectory() &&
    readFileSync(marker, 'utf8') === readIdentity(folder)
  );
}

// A refused entry never goes back to its name, because a rename replaces an empty folder that took
// the name since. It stays beside the holding folder, under a name of its own.
function setEntryAside(held: string, rename: (from: string, to: string) => void): void {
  rename(held, `${dirname(held)}.kept`);
}
