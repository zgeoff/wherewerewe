import type { UnreadRows } from '../types.ts';

export function formatUnreadNote(name: string, unread: UnreadRows, subject: string): string {
  const where =
    unread.line === null
      ? `${unread.file} does not parse: ${unread.reason}.`
      : `${unread.file} line ${String(unread.line)} does not parse: ${unread.reason}.`;

  return `www: ${name}'s ${where} ${subject} leaves out what it could not read. Fix the file by hand.\n`;
}
