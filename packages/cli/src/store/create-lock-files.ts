import { randomBytes } from 'node:crypto';
import {
  closeSync,
  fstatSync,
  linkSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { isErrorCode } from './is-error-code.ts';
import type { LockFileState, LockFiles } from './types.ts';

export function createLockFiles(): LockFiles {
  return { create: createLockFile, read: readLockFile, remove: unlinkSync };
}

// The content goes into a file of a name no other writer uses, and a hard link then makes the path
// exclusively, as `wx` would, so no reader ever sees a lock that is half written.
function createLockFile(path: string, content: string): LockFileState | null {
  const draftPath = `${path}.new-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  const handle = openSync(draftPath, 'wx');

  try {
    writeSync(handle, content);

    const stats = fstatSync(handle);

    linkSync(draftPath, path);

    return { ino: stats.ino, content, mtimeMs: stats.mtimeMs };
  } catch (error) {
    if (isErrorCode(error, 'EEXIST')) {
      return null;
    }

    throw error;
  } finally {
    closeSync(handle);
    unlinkSync(draftPath);
  }
}

function readLockFile(path: string): LockFileState | null {
  const handle = openIfFound(path);

  if (handle === null) {
    return null;
  }

  try {
    const stats = fstatSync(handle);

    return { ino: stats.ino, content: readFileSync(handle, 'utf8'), mtimeMs: stats.mtimeMs };
  } finally {
    closeSync(handle);
  }
}

function openIfFound(path: string): number | null {
  try {
    return openSync(path, 'r');
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}
