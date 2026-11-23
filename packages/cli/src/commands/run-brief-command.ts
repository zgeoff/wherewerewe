import { buildBriefInput } from '../brief/build-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import type { CLIResult, Store } from '../types.ts';

// What a read could not use of the store: the file, the first row that broke, and why.
export interface UnreadRows {
  readonly file: string;
  readonly line: number | null;
  readonly reason: string;
}

// Prints the brief. This slice runs no check and saves nothing, so it takes no lock. A file that
// does not parse is never a refusal for a read: the brief prints what it can and says on stderr
// what it left out.
export function runBriefCommand(store: Store, nowMs: number, unread: UnreadRows | null): CLIResult {
  return {
    exitCode: 0,
    stdout: renderBrief(buildBriefInput(store, nowMs)),
    stderr: unread === null ? '' : formatUnreadNote(store.session.name, unread),
  };
}

function formatUnreadNote(name: string, unread: UnreadRows): string {
  const where =
    unread.line === null
      ? `${unread.file} does not parse: ${unread.reason}.`
      : `${unread.file} line ${String(unread.line)} does not parse: ${unread.reason}.`;

  return `www: ${name}'s ${where} The brief leaves out what it could not read. Fix the file by hand.\n`;
}
