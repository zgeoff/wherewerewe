import { lstatSync } from 'node:fs';

// What names one entry on disk, a link not followed: its device, inode and birth time. A folder
// that replaces another at the same name differs in at least its birth time.
export function readPathIdentity(path: string): string {
  const info = lstatSync(path, { bigint: true });

  return `${String(info.dev)}:${String(info.ino)}:${String(info.birthtimeNs)}`;
}
