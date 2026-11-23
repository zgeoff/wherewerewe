import type { JournalRow } from '../types.ts';
import { journalHeader } from './constants.ts';

// One journal line as a row, or null for the header and a line that is not a row.
export function parseJournalLine(line: string): JournalRow | null {
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
    return null;
  }

  return {
    ts,
    op,
    id,
    by,
    text: toNullable(rowText),
    why: toNullable(why),
    extra: toNullable(extra),
  };
}

const authors: ReadonlySet<string> = new Set(['agent', 'owner', 'hook', 'import']);

function isAuthor(value: string | undefined): value is JournalRow['by'] {
  return value !== undefined && authors.has(value);
}

function toNullable(cell: string): string | null {
  return cell === '-' ? null : cell;
}
