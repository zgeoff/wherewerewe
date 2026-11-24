import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';
import { checkPathName } from './check-path-name.ts';
import { resolvePathsFolder } from './resolve-paths-folder.ts';

// Makes the folder `<run>/paths/<name>` that a journey gives to a --path check, and returns it. It
// leaves a marker beside the folder, which is how `removePath` knows it made the folder. A name that
// exists is a usage error, so a second run never reads a folder an earlier one left.
export function makePath(stateRoot: string, name: string): string {
  checkPathName(name);
  resolvePathsFolder(stateRoot);

  const folder = join(stateRoot, 'paths', name);

  if (existsSync(folder)) {
    throw new WringerError('usage', {
      message: `The path ${name} exists in this run. Run \`bun verify up --restart\` first.`,
    });
  }

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(stateRoot, 'paths', `.made-${name}`), '');

  return folder;
}
