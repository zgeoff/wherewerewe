import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Row } from '../types.ts';

// Adds one line. The file is only ever appended to, so two writers at once both land.
export async function appendRow(root: string, name: string, row: Row): Promise<void> {
  await mkdir(join(root, name), { recursive: true });
  await appendFile(join(root, name, 'rows.jsonl'), `${JSON.stringify(row)}\n`);
}
