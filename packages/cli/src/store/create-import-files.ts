import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
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
    makeFolder: (path) => {
      mkdirSync(path);
    },
    copyFile: (from, to) => {
      writeSyncedFile(to, readFileSync(from));
    },
    writeFile: writeSyncedFile,
    rename: renameSync,
  };
}

function writeSyncedFile(path: string, content: string | Uint8Array): void {
  const handle = openSync(path, 'wx');

  try {
    writeFileSync(handle, content);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}
