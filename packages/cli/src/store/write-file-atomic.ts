import { randomBytes } from 'node:crypto';
import { closeSync, fchmodSync, fsyncSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';

export interface AtomicWriteSeam {
  // called with the temporary file just after it is made, before any text is written
  readonly afterOpen?: (temporaryPath: string) => void;

  // called last before the rename; `false` drops the temporary file and keeps the old one
  readonly isStillValid?: () => boolean;
}

// Writes the file through a temporary file and a rename over it, so a reader sees the old file or
// the new one. With a mode, the temporary file has exactly that mode before any text goes in.
// Returns `false` when `isStillValid` says no.
export function writeFileAtomic(
  path: string,
  text: string,
  mode?: number,
  seam: AtomicWriteSeam = {},
): boolean {
  const temporaryPath = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  const handle = openSync(temporaryPath, 'wx', mode ?? 0o666);

  try {
    if (mode !== undefined) {
      fchmodSync(handle, mode);
    }

    seam.afterOpen?.(temporaryPath);
    writeSync(handle, text);
    fsyncSync(handle);
  } catch (error) {
    closeSync(handle);
    rmSync(temporaryPath, { force: true });
    throw error;
  }

  closeSync(handle);

  if (seam.isStillValid?.() === false) {
    rmSync(temporaryPath, { force: true });

    return false;
  }

  renameSync(temporaryPath, path);

  return true;
}
