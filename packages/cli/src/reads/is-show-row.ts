import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

// Whether show needs the row for the id: a row of the id itself, or a decision that is about it or
// replaces it.
export function isShowRow(row: JournalRow, id: string): boolean {
  if (row.id === id) {
    return true;
  }

  return (
    (row.op === 'decide' || row.op === 'ruled-out') &&
    (findExtraValue(row.extra, 'on') === id || findExtraValue(row.extra, 'replaces') === id)
  );
}
