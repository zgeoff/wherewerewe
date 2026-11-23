interface HandKeptItemCells {
  readonly id?: string;
  readonly kind?: string;
  readonly claim?: string;
  readonly check?: string;
  readonly by?: string;
  readonly extra?: string;
}

// A tab-separated row of a hand-kept items.tsv: an unchecked task written on 2026-03-02, with the
// cells the test names laid over it.
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
