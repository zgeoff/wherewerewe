import {
  closeSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import type { ImportFiles } from './types.ts';

export function createImportFiles(): ImportFiles {
  return {
    exists: existsSync,
    list: (path) => readdirSync(path),
    removeFolder: (path) => {
      rmSync(path, { recursive: true, force: true });
    },
    removeFile: (path) => {
      rmSync(path, { force: true });
    },
    makeFolder: (path) => {
      mkdirSync(path, { mode: 0o700 });
    },
    copyFile: (from, to) => {
      writeSyncedFile(to, readFileSync(from), readMode(from));
    },
    readMode,
    writeFile: writeSyncedFile,
    rename: renameSync,
  };
}

function writeSyncedFile(path: string, content: string | Uint8Array, mode: number): void {
  const handle = openSync(path, 'wx', mode);

  try {
    fchmodSync(handle, mode);
    writeFileSync(handle, content);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}

function readMode(path: string): number {
  return statSync(path).mode & 0o777;
}
