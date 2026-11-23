export interface HandKeptFiles {
  readonly session: string;
  readonly items: string | null;
  readonly journal: string | null;
}

interface HandKeptLine {
  readonly line: number;
  readonly text: string;
}

export interface HandKeptRow {
  readonly line: number;
  readonly cells: readonly string[];
}

interface HandKeptTable {
  readonly header: string | null;
  readonly rows: readonly HandKeptRow[];
}

export interface HandKeptStore {
  readonly session: readonly HandKeptLine[];
  readonly items: HandKeptTable;
  readonly journal: HandKeptTable;
}

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
