import type { Note } from '../types.ts';
import { notesHeader } from './constants.ts';

export function formatNotesFile(notes: readonly Note[]): string {
  const rows = notes.map((note) =>
    [note.id, note.owed ? 'owed' : '-', note.written, note.note].join('\t'),
  );

  return `${[notesHeader, ...rows].join('\n')}\n`;
}
