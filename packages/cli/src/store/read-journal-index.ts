import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { collectDecisionsInForce } from '../brief/collect-decisions-in-force.ts';
import { collectReplacedIDs } from '../brief/collect-replaced-ids.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalIndex, JournalRow, LastJournalRow, RowFile } from '../types.ts';
import { journalHeader } from './constants.ts';
import { parseJournalLine } from './parse-journal-line.ts';

const closingOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);
const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);

export async function readJournalIndex(folder: string): Promise<JournalIndex> {
  const closed = new Map<string, string>();

  const lastRows = {
    items: new Map<string, LastJournalRow>(),
    lesson: new Map<string, LastJournalRow>(),
    promise: new Map<string, LastJournalRow>(),
    words: new Map<string, LastJournalRow>(),
  };

  const decisions = new Map<string, { readonly who: 'owner' | 'agent' | null }>();

  const decideRows: JournalRow[] = [];
  let lastDecisionNumber = 0;
  let lastOwnerNoteNumber = 0;
  const stream = createReadStream(join(folder, 'journal.tsv'), 'utf8');

  stream.on('error', () => {});

  try {
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      const [ts, op, id] = line.split('\t', 3);

      if (line === journalHeader || ts === undefined || op === undefined || id === undefined) {
        continue;
      }

      const cells = line.split('\t');

      if (closingOps.has(op)) {
        closed.set(id, ts);
      }

      lastRows[findRowFile(op, readCell(cells[6]))].set(id, { op, text: readCell(cells[4]) });

      if (op === 'say') {
        lastOwnerNoteNumber = Math.max(lastOwnerNoteNumber, readNumber(id, 'o') ?? 0);
      }

      const number = decisionOps.has(op) ? readNumber(id, 'd') : null;

      if (op === 'decide') {
        const row = parseJournalLine(line);

        if (row !== null) {
          decideRows.push(row);
        }
      }

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

  return {
    closed,
    lastRows,
    decisions,
    replaced: collectReplacedIDs(decideRows),
    inForce: collectDecisionsInForce(decideRows),
    lastDecisionNumber,
    lastOwnerNoteNumber,
  };
}

// A lesson, promise or words write is in its own file, and so is a close whose kind= names one of
// them. Every other row, the closes of the tool before those files included, is in items.tsv.
function findRowFile(op: string, extra: string | null): RowFile {
  const kind = closingOps.has(op) ? findExtraValue(extra, 'kind') : op;

  return kind === 'lesson' || kind === 'promise' || kind === 'words' ? kind : 'items';
}

function readCell(cell: string | undefined): string | null {
  return cell === undefined || cell === '-' ? null : cell;
}

function readNumber(id: string, prefix: 'd' | 'o'): number | null {
  const digits = new RegExp(`^${prefix}-(?<number>\\d+)$`, 'u').exec(id)?.groups?.['number'];

  const number = digits === undefined ? null : Number(digits);

  return number !== null && Number.isSafeInteger(number) ? number : null;
}

function readWho(extra: string | null): 'owner' | 'agent' | null {
  const who = findExtraValue(extra, 'who');

  return who === 'owner' || who === 'agent' ? who : null;
}
