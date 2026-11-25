import { readFileSync } from 'node:fs';

// The text of a file, or `null` when it cannot be read: it is missing or it is not a file.
export function readTextOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
