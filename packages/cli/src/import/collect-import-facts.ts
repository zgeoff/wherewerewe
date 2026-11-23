import type { HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts, JournalFact, Question } from './types.ts';

export function collectImportFacts(hand: HandKeptStore): Facts {
  const journal = hand.journal.rows.flatMap((row): JournalFact[] => {
    const [ts, op, id, text] = row.cells;

    return row.cells.length === 4 && ts !== undefined && op !== undefined && id !== undefined
      ? [
          {
            line: row.line,
            ts: stripCarriageReturn(ts),
            op: stripCarriageReturn(op),
            id: stripCarriageReturn(id),
            text: stripCarriageReturn(text ?? ''),
            hasCarriageReturn: row.cells.some((cell) => cell.includes('\r')),
          },
        ]
      : [];
  });

  const itemRows = hand.items.rows.filter((row) => row.cells.length === 9);

  return {
    journal,
    questions: collectQuestions(journal),
    settledIDs: new Set(
      journal.filter((row) => row.op === 'done' || row.op === 'closed').map((row) => row.id),
    ),
    itemRows,
    claims: new Map(itemRows.map((row) => [row.cells[0] ?? '', row.cells[2] ?? ''])),
  };
}

function collectQuestions(journal: readonly JournalFact[]): Question[] {
  return journal.flatMap((row, index): Question[] =>
    row.op === 'open' &&
    !journal.slice(index + 1).some((later) => later.op === 'closed' && later.id === row.id)
      ? [{ line: row.line, id: row.id, text: row.text, ts: row.ts }]
      : [],
  );
}
