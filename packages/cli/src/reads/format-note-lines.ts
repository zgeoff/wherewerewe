import { formatAge } from '../brief/format-age.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Note } from '../types.ts';

// An item's note under its row, as `www show` and `www list` print it: `    note (<age>): …` or
// `    owed note (<age>): …`, wrapped, with each stored line redacted before it is wrapped.
export function formatNoteLines(note: Note, nowMs: number): string[] {
  const age = formatAge(nowMs - Date.parse(note.written));

  return wrapBlock(
    redactCredential(note.note),
    `    ${note.owed ? 'owed note' : 'note'} (${age}): `,
    '    ',
  );
}
