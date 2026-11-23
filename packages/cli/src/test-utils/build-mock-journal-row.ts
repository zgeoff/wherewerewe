import type { JournalRow } from '../types.ts';

// An agent's journal row with no text, why or extra, with the fields the test names laid over it.
export function buildMockJournalRow(
  fields: Partial<JournalRow> & { readonly ts: string; readonly op: string; readonly id: string },
): JournalRow {
  return { by: 'agent', text: null, why: null, extra: null, ...fields };
}
