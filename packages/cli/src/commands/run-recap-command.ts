import { basename } from 'node:path';
import { isLogRow } from '../reads/is-log-row.ts';
import { parseSince } from '../reads/parse-since.ts';
import { renderRecap } from '../reads/render-recap.ts';
import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, JournalRow, ParsedArgs, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import type { ReadAt } from './types.ts';

// Reads the grant, the notes and the journal since --since, and prints them on one screen. It
// takes no lock, runs no check and writes no file.
export async function runRecapCommand(
  store: Store,
  args: ParsedArgs,
  at: ReadAt,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  const nowMs = at.nowMs;
  const sinceText = args.values.since ?? '24h';
  const parsed = parseSince(sinceText, nowMs, store.session.started);

  if (parsed === null) {
    return buildRefusalResult(
      buildRefusal({ kind: 'bad-since', command: 'recap' }),
      buildRefusalScope(args, at.cwd),
    );
  }

  const fromMs = Math.max(parsed, Date.parse(store.session.started));
  let rows: JournalRow[] | null = null;
  let journalUnread: UnreadRows | null = null;

  try {
    rows = await readJournalRows(store.folder, (row) =>
      isLogRow(row, { fromMs, ops: null, id: null }),
    );
  } catch (error) {
    journalUnread = {
      file: 'journal.tsv',
      line: null,
      reason: error instanceof Error && 'code' in error ? String(error.code) : 'read failed',
    };
  }

  const notes = [unread, store.notesUnread, store.promisesUnread, journalUnread].flatMap((found) =>
    found === null ? [] : [formatUnreadNote(store.session.name, found, 'This read')],
  );

  return {
    exitCode: 0,
    stdout: renderRecap({
      session: store.session,
      items: store.items,
      notes: store.notes,
      promises: store.promises,
      rows,
      sinceText,
      sessionID: basename(store.folder),
      sessionFlag: args.sessionFlag,
      fromMs,
      nowMs,
    }),
    stderr: notes.join(''),
  };
}
