import { journalHeader } from '../store/constants.ts';
import { parseJournalLine } from '../store/parse-journal-line.ts';

export interface JournalProblem {
  readonly line: number;
  readonly reason: string;
}

// The first thing wrong with a journal the upgrade copies as it is: a header that is not the
// journal's, or a line that is no row. A torn last line counts, because the upgrade ends it with a
// newline and so makes it a row.
export function findJournalProblem(text: string): JournalProblem | null {
  const lines = text.split('\n');

  if (lines[0] !== journalHeader) {
    return { line: 1, reason: 'the header is not the journal header' };
  }

  const at = lines.findIndex(
    (line, index) => index > 0 && line !== '' && parseJournalLine(line) === null,
  );

  return at === -1 ? null : { line: at + 1, reason: 'the line is not a journal row' };
}
