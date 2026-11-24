import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

export interface DecisionInForce {
  readonly id: string;
  readonly choice: string;
}

// The decisions in force, newest first by ts, the higher d-<n> first on a tie. A decide row is in
// force unless a later decide row's replaces names it; a ruled-out row never is. A decision on a
// closed item stays in force.
export function collectDecisionsInForce(rows: readonly JournalRow[]): DecisionInForce[] {
  const replaced = new Set(
    rows.flatMap((row) => {
      const id = row.op === 'decide' ? findExtraValue(row.extra, 'replaces') : null;

      return id === null ? [] : [id];
    }),
  );

  return rows
    .filter((row) => row.op === 'decide' && !replaced.has(row.id))
    .toSorted((first, second) => {
      if (first.ts !== second.ts) {
        return first.ts < second.ts ? 1 : -1;
      }

      return parseDecisionNumber(second.id) - parseDecisionNumber(first.id);
    })
    .map((row) => ({ id: row.id, choice: row.text ?? '' }));
}

function parseDecisionNumber(id: string): number {
  const digits = /^d-(?<number>\d+)$/u.exec(id)?.groups?.['number'];

  return digits === undefined ? 0 : Number(digits);
}
