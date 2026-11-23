import type { JournalRow } from '../types.ts';
import { journalHeader } from './constants.ts';

// Drops a last line with no newline, so a read that races an append never sees half a row.
export function parseJournalFile(text: string): JournalRow[] {
  const lines = text.split('\n').slice(0, -1);

  return lines.flatMap((line) => {
    const [ts, op, id, by, rowText, why, extra, ...more] = line.split('\t');

    if (
      line === journalHeader ||
      more.length > 0 ||
      ts === undefined ||
      op === undefined ||
      id === undefined ||
      rowText === undefined ||
      why === undefined ||
      extra === undefined ||
      !isAuthor(by)
    ) {
      return [];
    }

    return [
      { ts, op, id, by, text: toNullable(rowText), why: toNullable(why), extra: toNullable(extra) },
    ];
  });
}

const authors: ReadonlySet<string> = new Set(['agent', 'owner', 'hook', 'import']);

function isAuthor(value: string | undefined): value is JournalRow['by'] {
  return value !== undefined && authors.has(value);
}

function toNullable(cell: string): string | null {
  return cell === '-' ? null : cell;
}
