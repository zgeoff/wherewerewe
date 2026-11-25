import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// One hash of every file under a folder: each relative path, mode and the bytes, and each link's
// target. A test hashes a home before and after to show that a command wrote nothing.
export function readFolderHash(folder: string): string {
  const hash = createHash('sha256');

  for (const line of listEntries(folder, '')) {
    hash.update(`${line}\n`);
  }

  return hash.digest('hex');
}

function listEntries(folder: string, prefix: string): string[] {
  const lines: string[] = [];

  for (const name of readdirSync(folder).toSorted((left, right) => left.localeCompare(right))) {
    const path = join(folder, name);
    const stat = lstatSync(path);
    const relative = `${prefix}/${name}`;

    if (stat.isDirectory()) {
      lines.push(`${relative}/`, ...listEntries(path, relative));
    } else {
      const content = stat.isSymbolicLink() ? 'link' : readFileSync(path).toString('base64');

      lines.push(`${relative} ${String(stat.mode % 0o1000)} ${content}`);
    }
  }

  return lines;
}
