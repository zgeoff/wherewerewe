export type RowsParse<Row> =
  | { readonly kind: 'rows'; readonly rows: readonly Row[] }
  | {
      readonly kind: 'broken';

      // the first row that does not parse
      readonly line: number;
      readonly reason: string;

      // the rows that do parse, which a read prints and a write never uses
      readonly rows: readonly Row[];
    };

// Parses a tab-separated file of rows with unique ids: the header row, then one row a line. The
// rows that parse come back beside the first that does not, so a read can print what it can.
export function parseRowsFile<Row extends { readonly id: string }>(
  text: string,
  header: string,
  parseLine: (cells: readonly string[]) => Row | string,
): RowsParse<Row> {
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  if (lines[0] !== header) {
    return { kind: 'broken', line: 1, reason: 'the header row is missing or changed', rows: [] };
  }

  const columnCount = header.split('\t').length;
  const rows: Row[] = [];
  let firstBroken: { readonly line: number; readonly reason: string } | null = null;

  for (const [index, line] of lines.slice(1).entries()) {
    const cells = line.split('\t');

    const parsed =
      cells.length === columnCount
        ? parseLine(cells)
        : `expected ${String(columnCount)} tab-separated columns, found ${String(cells.length)}`;

    if (typeof parsed === 'string') {
      firstBroken ??= { line: index + 2, reason: parsed };
    } else if (rows.some((row) => row.id === parsed.id)) {
      firstBroken ??= { line: index + 2, reason: 'the id repeats an earlier row' };
    } else {
      rows.push(parsed);
    }
  }

  return firstBroken === null
    ? { kind: 'rows', rows }
    : { kind: 'broken', line: firstBroken.line, reason: firstBroken.reason, rows };
}
