import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Row } from '../types.ts';

// Adds one line. The file is only ever appended to, so two writers at once both land.
export async function appendRow(root: string, name: string, row: Row): Promise<void> {
  await mkdir(join(root, name), { recursive: true });

  // the line starts on a new line of its own, so a line cut short before it cannot swallow it
  await appendFile(join(root, name, 'rows.jsonl'), `\n${JSON.stringify(row)}\n`);
}
