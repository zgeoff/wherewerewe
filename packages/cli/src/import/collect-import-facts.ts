import type { HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts, JournalFact, Question } from './types.ts';

const closingOps: ReadonlySet<string> = new Set(['done', 'closed', 'drop', 'use']);

type PlainFact = Omit<JournalFact, 'closedText'>;

export function collectImportFacts(hand: HandKeptStore): Facts {
  const itemRows = hand.items.rows.filter((row) => row.cells.length === 9);

  const claims = new Map(
    itemRows.map((row) => [
      stripCarriageReturn(row.cells[0] ?? ''),
      stripCarriageReturn(row.cells[2] ?? ''),
    ]),
  );

  const plain = hand.journal.rows.flatMap((row): PlainFact[] => {
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

  const journal = plain.map((row, index): JournalFact => ({
    ...row,
    closedText: row.op === 'closed' ? findClosedText(row, plain.slice(0, index), claims) : null,
  }));

  return {
    journal,
    questions: collectQuestions(plain),
    settledIDs: new Set(plain.filter((row) => closingOps.has(row.op)).map((row) => row.id)),
    itemRows,
  };
}

function findClosedText(
  row: PlainFact,
  earlier: readonly PlainFact[],
  claims: ReadonlyMap<string, string>,
): string | null {
  return (
    claims.get(row.id) ??
    earlier.findLast((candidate) => candidate.op === 'open' && candidate.id === row.id)?.text ??
    null
  );
}

function collectQuestions(journal: readonly PlainFact[]): Question[] {
  return journal.flatMap((row, index): Question[] => {
    if (row.op !== 'open' || journal.slice(index + 1).some((later) => isClosing(later, row.id))) {
      return [];
    }

    const closedBefore = journal.slice(0, index).find((candidate) => isClosing(candidate, row.id));

    return [
      {
        line: row.line,
        id: row.id,
        text: row.text,
        ts: row.ts,
        closedLine: closedBefore?.line ?? null,
      },
    ];
  });
}

function isClosing(row: PlainFact, id: string): boolean {
  return closingOps.has(row.op) && row.id === id;
}
