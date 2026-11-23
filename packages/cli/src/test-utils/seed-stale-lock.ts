import { runGoneProcess } from './run-gone-process.ts';
import { seedStoreFile } from './seed-store-file.ts';

// Writes a lock file by hand that names a process which has already exited, which the store
// module cannot make: the lock a crashed writer leaves behind.
export async function seedStaleLock(folder: string): Promise<void> {
  const pid = await runGoneProcess();

  seedStoreFile(folder, 'lock', `pid=${String(pid)} ts=${new Date().toISOString()}\n`);
}
