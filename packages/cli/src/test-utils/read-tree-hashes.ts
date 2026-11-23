import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Maps the relative path of every file under the root, hidden folders included, to the SHA-256 of
// its content.
export async function readTreeHashes(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);

  const hashes: Record<string, string> = {};

  for (const entry of entries) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);

      const content = await readFile(path);

      hashes[path.slice(root.length + 1)] = createHash('sha256').update(content).digest('hex');
    }
  }

  return hashes;
}
