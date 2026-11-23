import { randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, openSync, renameSync, writeSync } from 'node:fs';

// Writes the file through a temporary file in the same folder and a rename over it, so a reader
// sees the old file or the new one.
export function writeFileAtomic(path: string, text: string): void {
  const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  const handle = openSync(temporaryPath, 'wx');

  try {
    writeSync(handle, text);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }

  renameSync(temporaryPath, path);
}
