import type { Note } from '../types.ts';

// An unowed note written on 2026-03-10, with the fields the test names laid over it.
export function buildMockNote(fields: Partial<Note> & { readonly id: string }): Note {
  return {
    owed: false,
    written: '2026-03-10T10:43:00Z',
    note: 'The simulator is shared on Fridays',
    ...fields,
  };
}
