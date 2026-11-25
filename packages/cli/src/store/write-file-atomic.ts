import { randomBytes } from 'node:crypto';
import { closeSync, fchmodSync, fsyncSync, openSync, renameSync, writeSync } from 'node:fs';

// Writes the file through a temporary file in the same folder and a rename over it, so a reader
// sees the old file or the new one. With a mode, the new file has exactly that mode.
export function writeFileAtomic(path: string, text: string, mode?: number): void {
  const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  const handle = openSync(temporaryPath, 'wx');

  try {
    writeSync(handle, text);

    if (mode !== undefined) {
      fchmodSync(handle, mode);
    }

    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }

  renameSync(temporaryPath, path);
}
