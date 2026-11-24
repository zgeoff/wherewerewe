import { WringerError } from '@wringer/core';

// Refuses a path name that is not 1 to 32 characters of a-z, 0-9 and a hyphen, so a journey names
// a folder inside the run and never one outside it.
export function checkPathName(name: string): void {
  if (!/^[a-z0-9-]{1,32}$/u.test(name)) {
    throw new WringerError('usage', {
      message: `The path name ${JSON.stringify(name)} must be 1 to 32 characters of a-z, 0-9 and a hyphen.`,
    });
  }
}
