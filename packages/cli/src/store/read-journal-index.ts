import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalIndex } from '../types.ts';

const closingOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);
const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);

// Reads the journal line by line and splits only the first three columns, so no text cell is
// ever held. It finds the ids that a done, drop or use row closed. On a decide or ruled-out row it
// also reads the extra column, to find who made the decision.
export async function readJournalIndex(folder: string): Promise<JournalIndex> {
  const closed = new Map<string, string>();
  const decisions = new Map<string, { readonly who: 'owner' | 'agent' | null }>();

  let lastDecisionNumber = 0;
  const stream = createReadStream(join(folder, 'journal.tsv'), 'utf8');

  stream.on('error', () => {});

  try {
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      const [ts, op, id] = line.split('\t', 3);

      if (ts === undefined || op === undefined || id === undefined) {
        continue;
      }

      if (closingOps.has(op)) {
        closed.set(id, ts);
      }

      const number = decisionOps.has(op) ? readDecisionNumber(id) : null;

      if (number !== null) {
        decisions.set(id, { who: readWho(line.split('\t')[6] ?? null) });

        lastDecisionNumber = Math.max(lastDecisionNumber, number);
      }
    }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  return { closed, decisions, lastDecisionNumber };
}

function readDecisionNumber(id: string): number | null {
  const digits = /^d-(?<number>\d+)$/u.exec(id)?.groups?.['number'];

  return digits === undefined ? null : Number(digits);
}

function readWho(extra: string | null): 'owner' | 'agent' | null {
  const who = findExtraValue(extra, 'who');

  return who === 'owner' || who === 'agent' ? who : null;
}
