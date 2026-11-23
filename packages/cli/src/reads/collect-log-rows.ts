import type { JournalRow } from '../types.ts';

export interface LogFilter {
  // keeps a row at or after this time, or every row when null
  readonly fromMs: number | null;

  // keeps a row whose op is listed, or every row when null
  readonly ops: readonly string[] | null;

  // keeps a row with this id, or every row when null
  readonly id: string | null;
}

export function collectLogRows(rows: readonly JournalRow[], filter: LogFilter): JournalRow[] {
  return rows.filter(
    (row) =>
      (filter.fromMs === null || Date.parse(row.ts) >= filter.fromMs) &&
      (filter.ops === null || filter.ops.includes(row.op)) &&
      (filter.id === null || row.id === filter.id),
  );
}
