import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

// The ids of the decisions that a later decide row replaces. A replaces= counts only when the row
// it names comes before it in the journal, so a hand-kept row that names a decision written after
// it replaces nothing.
export function collectReplacedIDs(rows: readonly JournalRow[]): Set<string> {
  const written = new Set<string>();
  const replaced = new Set<string>();

  for (const row of rows) {
    if (row.op !== 'decide') {
      continue;
    }

    const id = findExtraValue(row.extra, 'replaces');

    if (id !== null && written.has(id)) {
      replaced.add(id);
    }

    written.add(row.id);
  }

  return replaced;
}
