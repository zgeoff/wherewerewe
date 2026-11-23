import { collectLogRows } from '../reads/collect-log-rows.ts';
import { parseSince } from '../reads/parse-since.ts';
import { renderLog } from '../reads/render-log.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatRefusal } from '../refusals/format-refusal.ts';
import { readRefusalScope } from '../refusals/read-refusal-scope.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import type { CLIResult, ParsedArgs, Store } from '../types.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import type { UnreadRows } from './format-unread-note.ts';

// Prints the journal, oldest first, kept to the rows that --since, --op and --id name. A --since
// it cannot read is a usage error, the one way a read is refused.
export async function runLogCommand(
  store: Store,
  args: ParsedArgs,
  nowMs: number,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  const since = args.values.since;
  const fromMs = since === undefined ? null : parseSince(since, nowMs, store.session.started);

  if (since !== undefined && fromMs === null) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: formatRefusal(buildRefusal({ kind: 'bad-since' }), readRefusalScope(args)),
    };
  }

  const journal = await readJournalRows(store.folder);

  const rows = collectLogRows(journal, {
    fromMs,
    ops: args.values.op === undefined ? null : args.values.op.split(','),
    id: args.values.id ?? null,
  });

  return {
    exitCode: 0,
    stdout: renderLog(rows, store.session.started),
    stderr: unread === null ? '' : formatUnreadNote(store.session.name, unread, 'This read'),
  };
}
