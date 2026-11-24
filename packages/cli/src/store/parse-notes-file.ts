import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import type { Note } from '../types.ts';
import { notesHeader } from './constants.ts';

export type NotesParse =
  | { readonly kind: 'notes'; readonly notes: readonly Note[] }
  | {
      readonly kind: 'broken';

      // the first row that does not parse
      readonly line: number;
      readonly reason: string;

      // the rows that do parse, which a read prints and a write never uses
      readonly notes: readonly Note[];
    };

export function parseNotesFile(text: string): NotesParse {
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  if (lines[0] !== notesHeader) {
    return { kind: 'broken', line: 1, reason: 'the header row is missing or changed', notes: [] };
  }

  const notes: Note[] = [];
  let firstBroken: { readonly line: number; readonly reason: string } | null = null;

  for (const [index, line] of lines.slice(1).entries()) {
    const parsed = parseNoteLine(line);

    if (typeof parsed === 'string') {
      firstBroken ??= { line: index + 2, reason: parsed };
    } else if (notes.some((note) => note.id === parsed.id)) {
      firstBroken ??= { line: index + 2, reason: 'the id repeats an earlier row' };
    } else {
      notes.push(parsed);
    }
  }

  return firstBroken === null
    ? { kind: 'notes', notes }
    : { kind: 'broken', line: firstBroken.line, reason: firstBroken.reason, notes };
}

function parseNoteLine(line: string): Note | string {
  const cells = line.split('\t');
  const [id, owed, written, note] = cells;

  if (
    cells.length !== 4 ||
    id === undefined ||
    owed === undefined ||
    written === undefined ||
    note === undefined
  ) {
    return `expected 4 tab-separated columns, found ${String(cells.length)}`;
  }

  if (!isItemID(id)) {
    return 'the id is not an item id';
  }

  if (owed !== 'owed' && owed !== '-') {
    return 'the owed column is not owed or -';
  }

  if (written === '') {
    return 'the written time is empty';
  }

  if (findTextProblem(note, 400) !== null) {
    return 'the note is empty, longer than 400 characters or not one line';
  }

  return { id, owed: owed === 'owed', written, note };
}
