import type { JournalRow } from '../types.ts';

// An empty cell is a dash, so a text that is a dash, or that starts with a backslash, gets a
// backslash in front of it, and the parser takes that one backslash off.
export function formatJournalRows(rows: readonly JournalRow[]): string {
  return rows
    .map(
      (row) =>
        `${[row.ts, row.op, row.id, row.by, toCell(row.text), toCell(row.why), toCell(row.extra)].join('\t')}\n`,
    )
    .join('');
}

function toCell(cell: string | null): string {
  if (cell === null) {
    return '-';
  }

  return cell === '-' || cell.startsWith('\\') ? `\\${cell}` : cell;
}
