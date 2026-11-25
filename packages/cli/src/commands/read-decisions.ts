import { collectDecisionsInForce } from '../brief/collect-decisions-in-force.ts';
import type { BriefInput } from '../brief/types.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { JournalRow, UnreadRows } from '../types.ts';

// The decisions in force, read from the journal's decide rows. A journal that cannot be read gives
// none and is named, and never stops the brief.
export async function readDecisions(folder: string): Promise<{
  readonly decisions: BriefInput['decisions'];

  // every decide row of the journal, in journal order
  readonly rows: readonly JournalRow[];
  readonly unread: UnreadRows | null;
}> {
  try {
    const rows = await readJournalRows(folder, (row) => row.op === 'decide');

    return { decisions: collectDecisionsInForce(rows), rows, unread: null };
  } catch (error) {
    return {
      decisions: [],
      rows: [],
      unread: {
        file: 'journal.tsv',
        line: null,
        reason: error instanceof Error && 'code' in error ? String(error.code) : 'read failed',
      },
    };
  }
}
