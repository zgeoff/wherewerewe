import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { WringerError } from '@wringer/core';
import { checkPathName } from './check-path-name.ts';

// Makes the folder `<run>/paths/<name>` that a journey gives to a --path check, and returns it. A
// name that exists is a usage error, so a second run never reads a folder an earlier one left.
export function makePath(stateRoot: string, name: string): string {
  checkPathName(name);

  const folder = join(stateRoot, 'paths', name);

  if (existsSync(folder)) {
    throw new WringerError('usage', {
      message: `The path ${name} exists in this run. Run \`bun verify up --restart\` first.`,
    });
  }

  mkdirSync(folder, { recursive: true });

  return folder;
}
