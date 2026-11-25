import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Row, Rows } from '../types.ts';
import { isRecord } from '../utils/is-record.ts';
import { convertOldStore } from './convert-old-store.ts';

// Reads a session's rows. A store of version 0.1 is converted once, and its files are left.
export async function readRows(root: string, name: string): Promise<Rows> {
  const path = join(root, name, 'rows.jsonl');

  let text = await readFile(path, 'utf8').catch(() => null);

  if (text === null) {
    const converted = await convertOldStore(join(root, name));

    text = converted.map((row) => `${JSON.stringify(row)}\n`).join('');

    if (text !== '') {
      await writeFile(path, text, { flag: 'wx' }).catch(() => null);
    }
  }

  const raw = text.split('\n').filter((line) => line.trim() !== '');
  const lines = raw.map((line) => parseLine(line)).filter((row) => row !== null);

  const latest = new Map<string, Row>();

  for (const row of lines) {
    latest.set(row.id, row);
  }

  return { rows: [...latest.values()], lines, unreadable: raw.length - lines.length };
}

function parseLine(line: string): Row | null {
  try {
    const value: unknown = JSON.parse(line);

    return isRow(value) ? value : null;
  } catch {
    return null;
  }
}

function isRow(value: unknown): value is Row {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    typeof value['text'] === 'string'
  );
}
