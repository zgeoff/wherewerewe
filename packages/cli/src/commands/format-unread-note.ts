// What a read could not use of the store: the file, the first row that broke, and why.
export interface UnreadRows {
  readonly file: string;
  readonly line: number | null;
  readonly reason: string;
}

// The subject is what leaves the rows out, such as `The brief`.
export function formatUnreadNote(name: string, unread: UnreadRows, subject: string): string {
  const where =
    unread.line === null
      ? `${unread.file} does not parse: ${unread.reason}.`
      : `${unread.file} line ${String(unread.line)} does not parse: ${unread.reason}.`;

  return `www: ${name}'s ${where} ${subject} leaves out what it could not read. Fix the file by hand.\n`;
}
