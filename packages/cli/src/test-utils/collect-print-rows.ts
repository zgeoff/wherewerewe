// The rows of a printed text, each as one string. Every line that matches `start` opens a row, and
// the lines after it that do not match belong to it; a line before the first row belongs to none.
// With no `start`, the whole text is one row.
export function collectPrintRows(text: string, start: RegExp | null): string[] {
  if (start === null) {
    return [text];
  }

  const rows: string[] = [];

  for (const line of text.split('\n')) {
    if (start.test(line)) {
      rows.push(line);
    } else if (rows.length > 0) {
      rows[rows.length - 1] += `\n${line}`;
    }
  }

  return rows;
}
