interface HandKeptQuestionCells {
  readonly ts?: string;
  readonly id: string;
  readonly text: string;
}

export function buildHandKeptQuestionRow(cells: HandKeptQuestionCells): string {
  return `${cells.ts ?? '2026-03-02T10:00:00Z'}\topen\t${cells.id}\t${cells.text}`;
}
