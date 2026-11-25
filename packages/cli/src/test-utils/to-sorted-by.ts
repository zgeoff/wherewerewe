// A copy of the rows in the order of their keys, which keeps every row, a repeated one included, so
// a whole-row comparison sees a row printed twice.
export function toSortedBy<Row>(rows: readonly Row[], getKey: (row: Row) => string): Row[] {
  return rows.toSorted((first, second) => getKey(first).localeCompare(getKey(second)));
}
