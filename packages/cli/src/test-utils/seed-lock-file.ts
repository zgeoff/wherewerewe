import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { LockFileState } from '../store/types.ts';
import { seedStoreFile } from './seed-store-file.ts';

// Writes a lock or claim file by hand, as another process would have left it, and returns what a
// reader of it sees.
export function seedLockFile(folder: string, name: string, content: string): LockFileState {
  seedStoreFile(folder, name, content);

  const stats = statSync(join(folder, name));

  return { ino: stats.ino, content, mtimeMs: stats.mtimeMs };
}
