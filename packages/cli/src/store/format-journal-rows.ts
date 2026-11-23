import type { JournalRow } from '../types.ts';

export function formatJournalRows(rows: readonly JournalRow[]): string {
  return rows
    .map(
      (row) =>
        `${[row.ts, row.op, row.id, row.by, toCell(row.text), toCell(row.why), toCell(row.extra)].join('\t')}\n`,
    )
    .join('');
}

// Each write refuses a text of a lone dash, so a dash is always an empty cell.
function toCell(cell: string | null): string {
  return cell ?? '-';
}
