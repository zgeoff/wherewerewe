import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { JournalIndex } from '../types.ts';

const closingOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);

// Reads the journal line by line and splits only the first three columns, so no text cell is
// ever held. It finds the ids that a done, drop or use row closed.
export async function readJournalIndex(folder: string): Promise<JournalIndex> {
  const closed = new Map<string, string>();

  const stream = createReadStream(join(folder, 'journal.tsv'), 'utf8');

  stream.on('error', () => {});

  try {
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      const [ts, op, id] = line.split('\t', 3);

      if (ts !== undefined && op !== undefined && id !== undefined && closingOps.has(op)) {
        closed.set(id, ts);
      }
    }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  return { closed };
}
