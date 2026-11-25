import { readdir } from 'node:fs/promises';
import { isName } from './is-name.ts';

export async function listSessions(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isDirectory() && isName(entry.name))
    .map((entry) => entry.name)
    .toSorted();
}
