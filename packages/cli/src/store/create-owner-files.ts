import { randomBytes } from 'node:crypto';
import { appendFileSync, closeSync, fsyncSync, openSync, renameSync, writeSync } from 'node:fs';
import type { OwnerFiles } from './types.ts';

export function createOwnerFiles(): OwnerFiles {
  return {
    append: (path, text) => {
      appendFileSync(path, text);
    },
    writeTemporary: (path, text) => {
      const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
      const handle = openSync(temporaryPath, 'wx');

      try {
        writeSync(handle, text);
        fsyncSync(handle);
      } finally {
        closeSync(handle);
      }

      return temporaryPath;
    },
    rename: renameSync,
  };
}
