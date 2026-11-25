import type { JournalRow } from '../types.ts';
import { collectReplacedIDs } from './collect-replaced-ids.ts';

// The decide rows in force, newest first by ts, the higher d-<n> first on a tie. A decide row is in
// force unless a later decide row's replaces names it, later in journal order; a ruled-out row never
// is. A decision on a closed item stays in force.
export function collectDecisionRowsInForce(rows: readonly JournalRow[]): JournalRow[] {
  const replaced = collectReplacedIDs(rows);

  return rows
    .filter((row) => row.op === 'decide' && !replaced.has(row.id))
    .toSorted((first, second) => {
      if (first.ts !== second.ts) {
        return first.ts < second.ts ? 1 : -1;
      }

      return parseDecisionNumber(second.id) - parseDecisionNumber(first.id);
    });
}

function parseDecisionNumber(id: string): number {
  const digits = /^d-(?<number>\d+)$/u.exec(id)?.groups?.['number'];

  return digits === undefined ? 0 : Number(digits);
}
