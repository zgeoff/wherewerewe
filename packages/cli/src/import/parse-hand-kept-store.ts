// The text of a hand-kept store's files, each null when the file is missing.
export interface HandKeptFiles {
  readonly session: string;
  readonly items: string | null;
  readonly journal: string | null;
}

interface HandKeptLine {
  // 1 is the first line of the file
  readonly line: number;
  readonly text: string;
}

export interface HandKeptRow {
  readonly line: number;
  readonly cells: readonly string[];
}

interface HandKeptTable {
  // the first line, or null when the file is missing or empty
  readonly header: string | null;
  readonly rows: readonly HandKeptRow[];
}

export interface HandKeptStore {
  readonly session: readonly HandKeptLine[];
  readonly items: HandKeptTable;
  readonly journal: HandKeptTable;
}

// Splits each file into lines that keep their number in the file, and skips a blank line.
export function parseHandKeptStore(files: HandKeptFiles): HandKeptStore {
  return {
    session: collectLines(files.session),
    items: parseTable(files.items),
    journal: parseTable(files.journal),
  };
}

function collectLines(text: string): HandKeptLine[] {
  return text
    .split('\n')
    .map((lineText, index) => ({ line: index + 1, text: lineText }))
    .filter((entry) => entry.text !== '');
}

function parseTable(text: string | null): HandKeptTable {
  if (text === null || text === '') {
    return { header: null, rows: [] };
  }

  const lines = text.split('\n');

  return {
    header: lines[0] ?? null,
    rows: lines
      .map((lineText, index) => ({ line: index + 1, text: lineText }))
      .slice(1)
      .filter((entry) => entry.text !== '')
      .map((entry) => ({ line: entry.line, cells: entry.text.split('\t') })),
  };
}
