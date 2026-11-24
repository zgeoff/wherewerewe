import { join } from 'node:path';
import { formatTimestamp } from '../format-timestamp.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { JournalRow, Note, ParsedArgs, RefusalReason, Store } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';

// What a write does to the item's note. `note` is the new row for a write.
export type NoteChange =
  | { readonly kind: 'keep' }
  | { readonly kind: 'write'; readonly note: Note }
  | { readonly kind: 'clear' };

// Reads --note, --owed and --no-note. A write that gives none keeps the item's note. Run the
// refusals first: this reads a command that passed them.
export function pickNoteChange(args: ParsedArgs, id: string, nowMs: number): NoteChange {
  if (args.values['no-note'] === true) {
    return { kind: 'clear' };
  }

  const text = args.values.note;

  return text === undefined
    ? { kind: 'keep' }
    : {
        kind: 'write',
        note: { id, owed: args.values.owed === true, written: formatTimestamp(nowMs), note: text },
      };
}

// The refusals of the note's flags and text, in this order: --owed with no --note, --note with
// --no-note, then the text of --note.
export function pickNoteTextRefusal(args: ParsedArgs): RefusalReason | null {
  const text = args.values.note;

  if (args.values.owed === true && text === undefined) {
    return { kind: 'owed-needs-note', args };
  }

  if (text !== undefined && args.values['no-note'] === true) {
    return { kind: 'note-and-no-note', args };
  }

  return text === undefined
    ? null
    : pickTextRefusal(
        args,
        [{ target: { label: 'note', place: { flag: 'note' } }, text, limit: textLimits.note }],
        false,
      );
}

export function pickNoClearRefusal(
  args: ParsedArgs,
  id: string,
  existing: Note | undefined,
): RefusalReason | null {
  return args.values['no-note'] === true && existing === undefined
    ? { kind: 'no-note-to-clear', args, id }
    : null;
}

// A write that touches a note refuses while notes.tsv does not parse, so it never rewrites the
// file from the rows that did.
export function pickNotesUnreadRefusal(store: Store): RefusalReason | null {
  const unread = store.notesUnread;

  return unread === null
    ? null
    : {
        kind: 'broken-store',
        name: store.session.name,
        file: unread.file,
        path: join(store.folder, unread.file),
        line: unread.line,
        reason: unread.reason,
      };
}

export function hasNoteFlag(args: ParsedArgs): boolean {
  return args.values.note !== undefined || args.values['no-note'] === true;
}

// The whole new notes.tsv, or undefined when the change leaves the file as it is. A write replaces
// the row of the id in place, or appends it.
export function buildChangedNotes(
  notes: readonly Note[],
  id: string,
  change: NoteChange,
): readonly Note[] | undefined {
  if (change.kind === 'keep') {
    return undefined;
  }

  if (change.kind === 'clear') {
    return notes.filter((note) => note.id !== id);
  }

  return notes.some((note) => note.id === id)
    ? notes.map((note) => (note.id === id ? change.note : note))
    : [...notes, change.note];
}

export function buildNoteJournalRows(id: string, change: NoteChange, ts: string): JournalRow[] {
  if (change.kind === 'keep') {
    return [];
  }

  if (change.kind === 'clear') {
    return [{ ts, op: 'note', id, by: 'agent', text: null, why: null, extra: 'cleared=1' }];
  }

  return [
    {
      ts,
      op: 'note',
      id,
      by: 'agent',
      text: change.note.note,
      why: null,
      extra: change.note.owed ? 'owed=1' : null,
    },
  ];
}
