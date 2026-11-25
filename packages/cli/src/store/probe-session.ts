import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function probeSession(root: string, name: string): Promise<boolean> {
  const entries = await readdir(join(root, name)).catch(() => null);

  return entries !== null && (entries.includes('rows.jsonl') || entries.includes('session'));
}
