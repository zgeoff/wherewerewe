import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Writes a file into a session folder by hand, for a state the store module cannot make: a
// hand-kept session, a broken row, a lock held by another process or half a journal line.
export function seedStoreFile(folder: string, name: string, text: string): void {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, name), text);
}
