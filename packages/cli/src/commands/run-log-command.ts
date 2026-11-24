import { isLogRow } from '../reads/is-log-row.ts';
import { parseSince } from '../reads/parse-since.ts';
import { renderLog } from '../reads/render-log.ts';
import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, ParsedArgs, Store, UnreadRows } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';

export async function runLogCommand(
  store: Store,
  args: ParsedArgs,
  nowMs: number,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  const since = args.values.since;
  const fromMs = since === undefined ? null : parseSince(since, nowMs, store.session.started);

  if (since !== undefined && fromMs === null) {
    return buildRefusalResult(
      buildRefusal({ kind: 'bad-since', command: 'log' }),
      buildRefusalScope(args),
    );
  }

  const filter = {
    fromMs,
    ops: args.values.op === undefined ? null : args.values.op.split(','),
    id: args.values.id ?? null,
  };

  const rows = await readJournalRows(store.folder, (row) => isLogRow(row, filter));

  return {
    exitCode: 0,
    stdout: renderLog(rows, store.session.started),
    stderr: [unread, store.notesUnread]
      .flatMap((found) =>
        found === null ? [] : [formatUnreadNote(store.session.name, found, 'This read')],
      )
      .join(''),
  };
}
