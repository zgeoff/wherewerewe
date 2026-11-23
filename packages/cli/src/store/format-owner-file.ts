import type { OwnerNote } from '../types.ts';
import { ownerHeader } from './constants.ts';

export function formatOwnerFile(notes: readonly OwnerNote[]): string {
  const rows = notes.map((note) => [note.id, note.text, note.said, note.on ?? '-'].join('\t'));

  return `${[ownerHeader, ...rows].join('\n')}\n`;
}
