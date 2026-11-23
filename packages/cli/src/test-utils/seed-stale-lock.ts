import { seedStoreFile } from './seed-store-file.ts';

// Writes a lock file by hand that names a process which has already exited, which the store
// module cannot make: the lock a crashed writer leaves behind.
export async function seedStaleLock(folder: string): Promise<void> {
  const gone = Bun.spawn(['bun', '-e', '']);

  await gone.exited;

  seedStoreFile(folder, 'lock', `pid=${String(gone.pid)} ts=${new Date().toISOString()}\n`);
}
