import { randomBytes } from 'node:crypto';
import {
  closeSync,
  fchmodSync,
  fsyncSync,
  openSync,
  renameSync,
  statSync,
  writeSync,
} from 'node:fs';
import type { OwnerFiles } from './types.ts';
import { writeAppendNoFollow } from './write-append-no-follow.ts';

export function createOwnerFiles(): OwnerFiles {
  return {
    append: (path, text) => {
      writeAppendNoFollow(path, text);
    },
    writeTemporary: (path, text) => {
      const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
      const mode = readMode(path);
      const handle = openSync(temporaryPath, 'wx', mode);

      try {
        fchmodSync(handle, mode);
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

// The file's own mode, so a rewrite never widens what import or init made. Notes are private, so a
// missing owner.tsv takes owner-only access.
function readMode(path: string): number {
  try {
    return statSync(path).mode & 0o777;
  } catch {
    return 0o600;
  }
}
