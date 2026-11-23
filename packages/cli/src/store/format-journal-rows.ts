import type { JournalRow } from '../types.ts';

export function formatJournalRows(rows: readonly JournalRow[]): string {
  return rows
    .map(
      (row) =>
        `${[row.ts, row.op, row.id, row.by, row.text ?? '-', row.why ?? '-', row.extra ?? '-'].join('\t')}\n`,
    )
    .join('');
}
