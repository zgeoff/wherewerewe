import { parseJournalFile } from '../store/parse-journal-file.ts';
import type { FileKind } from '../types.ts';

// Each version of a row ever written is in its file, or the journal records what ended it: a later
// write of the id, which replaced it, or a close. So an id whose file holds no row has a close as
// its newest journal row of the kind, and a file that holds a row holds the newest write's text.
export function readCloseModelProblems(
  kind: FileKind,
  fileRows: ReadonlyMap<string, string>,
  journalText: string,
  ids: readonly string[],
): string[] {
  const rows = parseJournalFile(journalText).filter(
    (row) => row.op === kind || row.extra === `kind=${kind}`,
  );

  return ids.flatMap((id) => {
    const own = rows.filter((row) => row.id === id);
    const writes = own.filter((row) => row.op === kind);
    const held = fileRows.get(id);

    if (held === undefined) {
      return own.at(-1)?.op === kind ? [`${id} left its file with no close recorded`] : [];
    }

    return writes.at(-1)?.text === held ? [] : [`${id} holds a row no write recorded`];
  });
}
