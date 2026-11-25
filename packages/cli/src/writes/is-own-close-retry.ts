import type { LastJournalRow } from '../types.ts';

// True when the newest journal row of the id in its file is a close of the same op and text, which
// stopped before it rewrote the file. A later row of the id, such as a write that replaced the row
// in the same second, makes this a new close with a journal row of its own.
export function isOwnCloseRetry(
  last: LastJournalRow | undefined,
  command: 'done' | 'drop' | 'use',
  text: string,
): boolean {
  return last !== undefined && last.op === command && last.text === text;
}
