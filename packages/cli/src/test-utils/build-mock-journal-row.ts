import type { JournalRow } from '../types.ts';

export function buildMockJournalRow(
  fields: Partial<JournalRow> & { readonly ts: string; readonly op: string; readonly id: string },
): JournalRow {
  return { by: 'agent', text: null, why: null, extra: null, ...fields };
}
