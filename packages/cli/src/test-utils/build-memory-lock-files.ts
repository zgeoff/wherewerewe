import type { LockFileState, LockFiles } from '../store/types.ts';

// Lock files kept in memory, where every file gets inode 7, as a file system that reuses the
// inode of each removed file would give. `readSeen` throws when the file is missing.
export function buildMemoryLockFiles(): {
  readonly files: LockFiles;
  readonly readSeen: (path: string) => LockFileState;
} {
  const entries = new Map<string, LockFileState>();

  const files: LockFiles = {
    create: (path, content) => {
      if (entries.has(path)) {
        return null;
      }

      const entry = { ino: 7, content, mtimeMs: 0 };

      entries.set(path, entry);

      return entry;
    },
    read: (path) => entries.get(path) ?? null,
    remove: (path) => {
      entries.delete(path);
    },
  };

  return {
    files,
    readSeen: (path) => {
      const entry = entries.get(path);

      if (entry === undefined) {
        throw new Error(`no file at ${path}`);
      }

      return entry;
    },
  };
}
