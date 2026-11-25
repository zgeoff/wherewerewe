import { lstatSync } from 'node:fs';
import { isErrorCode } from './is-error-code.ts';

// Throws when the folder is a link, so no write lands in a folder outside the store that a link an
// agent planted points to. A folder that does not exist yet passes: the write makes it.
export function checkPlainFolder(folder: string): void {
  let isLink: boolean;

  try {
    isLink = lstatSync(folder).isSymbolicLink();
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return;
    }

    throw error;
  }

  if (isLink) {
    throw new Error(`${folder} is a link, so www writes nothing in it`);
  }
}
