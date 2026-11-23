interface HandKeptItemCells {
  readonly id?: string;
  readonly kind?: string;
  readonly claim?: string;
  readonly check?: string;
  readonly by?: string;
  readonly extra?: string;
}

export function buildHandKeptItemRow(cells: HandKeptItemCells): string {
  return [
    cells.id ?? 't-b',
    cells.kind ?? 'task',
    cells.claim ?? 'Another',
    cells.check ?? '-',
    '-',
    '-',
    '2026-03-02T09:00:00Z',
    cells.by ?? 'agent',
    cells.extra ?? '-',
  ].join('\t');
}
