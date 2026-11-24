// The row with the earliest `written`, the first of the file on a tie, or undefined for no row. A
// replacement keeps its place in the file and takes a new `written`, so the file's first row is not
// always the oldest.
export function findOldestRow<Row extends { readonly written: string }>(
  rows: readonly Row[],
): Row | undefined {
  return rows.reduce<Row | undefined>(
    (oldest, row) =>
      oldest === undefined || Date.parse(row.written) < Date.parse(oldest.written) ? row : oldest,
    undefined,
  );
}
