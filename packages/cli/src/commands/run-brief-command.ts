import { buildReadBriefInput } from '../brief/build-read-brief-input.ts';
import { buildReplyBriefInput } from '../brief/build-reply-brief-input.ts';
import { orderChecks } from '../brief/order-checks.ts';
import { renderBrief } from '../brief/render-brief.ts';
import type { BriefInput } from '../brief/types.ts';
import { checkLimits } from '../checks/check-limits.ts';
import { pickCheckSave } from '../checks/pick-check-save.ts';
import { pickSavedStore } from '../checks/pick-saved-store.ts';
import { runChecks } from '../checks/run-checks.ts';
import type { CheckRun } from '../checks/types.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildBriefJSON } from '../json/build-brief-json.ts';
import { formatJSONOutput } from '../json/format-json-output.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeCheckFiles } from '../store/write-check-files.ts';
import type { CommandResult, JournalRow, Store, UnreadRows } from '../types.ts';
import { buildBriefFigure } from '../writes/read-brief-figure.ts';
import { formatUnreadNote } from './format-unread-note.ts';
import { readDecisions } from './read-decisions.ts';
import type { CommandContext } from './types.ts';

// Prints the brief: probes every check and open pull request within the deadline, saves the
// results when the lock is free, and renders. A partial store probes the items that parsed and
// saves nothing; a file that does not parse is named on stderr.
export async function runBriefCommand(
  store: Store,
  context: CommandContext,
  unread: UnreadRows | null,
  host: 'claude' | 'codex' | null,
): Promise<CommandResult> {
  const decided = await readDecisions(store.folder);

  const briefContext = {
    nowMs: context.nowMs,
    sessionFlag: context.args.sessionFlag,
    host,
    decisions: decided.decisions,
  };

  const reply = buildReplyBriefInput(store, briefContext);

  const order = orderChecks({
    items: store.items,
    notes: store.notes,
    focus: store.session.now,
    pullRequests: reply.pullRequests,
  });

  const run = await runChecks(order, store.items, store.prs, {
    deadlineMs: checkLimits.deadlineMs,
    env: context.env,
    now: context.now,
  });

  const hidden = await readHiddenStep(store, run);

  const saved = unread === null ? await writeCheckResults(store, run, context.nowMs) : null;
  const input = buildReadBriefInput(store, { run, hidden: hidden.step, saved }, briefContext);

  const stderr = [
    unread,
    store.notesUnread,
    store.ownerUnread,
    store.prsUnread,
    store.lessonsUnread,
    store.promisesUnread,
    store.wordsUnread,
    decided.unread,
    hidden.unread,
  ]
    .flatMap((rows) =>
      rows === null ? [] : [formatUnreadNote(store.session.name, rows, 'The brief')],
    )
    .join('');

  if (context.args.values.json !== true) {
    return { exitCode: 0, stdout: renderBrief(input), stderr, stdoutFormat: 'text' };
  }

  const figureStore =
    unread === null && saved === null
      ? pickSavedStore(store, run, formatTimestamp(context.nowMs))
      : store;

  const figure = buildBriefFigure(
    figureStore,
    { nowMs: context.nowMs, sessionFlag: context.args.sessionFlag, host },
    decided.decisions,
  );

  return {
    exitCode: 0,
    stdout: formatJSONOutput(
      buildBriefJSON({
        brief: input,
        prs: store.prs,
        decisionRows: decided.rows,
        estimate: figure.tokens,
      }),
    ),
    stderr,
    stdoutFormat: 'json',
  };
}

// The next step of the item in focus hides with `changed after it was set` when the journal holds a
// changed row of the item after its last `now` row, and with `reads <result>` when this read's
// result differs from the item's last result, or from its result at write when it has no last one.
async function readHiddenStep(
  store: Store,
  run: CheckRun,
): Promise<{ readonly step: BriefInput['nowHidden']; readonly unread: UnreadRows | null }> {
  const focus = store.session.now;
  const item = store.items.find((candidate) => candidate.id === focus);

  if (focus === null || item === undefined) {
    return { step: null, unread: null };
  }

  const nowSet = store.session.nowSet;
  let isChangedInJournal = false;
  let unread: UnreadRows | null = null;

  if (nowSet !== null) {
    try {
      const rows = await readJournalRows(
        store.folder,
        (row) => (row.op === 'changed' || row.op === 'now') && row.id === focus,
      );

      isChangedInJournal = pickRowsAfterNow(rows, nowSet).some((row) => row.op === 'changed');
    } catch (error) {
      unread = {
        file: 'journal.tsv',
        line: null,
        reason: error instanceof Error && 'code' in error ? String(error.code) : 'read failed',
      };
    }
  }

  if (isChangedInJournal) {
    return { step: { kind: 'changed' }, unread };
  }

  const found = run.results.get(item.id);
  const old = item.last ?? item.atWrite;

  return {
    step:
      found !== undefined && found !== 'unchecked' && old !== null && found !== old
        ? { kind: 'reads', result: found }
        : null,
    unread,
  };
}

// The rows after the last `now` row of the item, in journal order, because a time to the second
// cannot order a change and a `now` that land in the same second. A journal with no `now` row for
// the item, as in an imported store, falls back to the rows from `now_set` on.
function pickRowsAfterNow(rows: readonly JournalRow[], nowSet: string): readonly JournalRow[] {
  const lastNow = rows.findLastIndex((row) => row.op === 'now');

  return lastNow === -1 ? rows.filter((row) => row.ts >= nowSet) : rows.slice(lastNow + 1);
}

// The lock is taken without waiting. Inside it, the files are read again, and a result applies
// only to an item that is still what the read probed, so a write that ran in between wins.
async function writeCheckResults(
  store: Store,
  run: CheckRun,
  nowMs: number,
): Promise<BriefInput['resultsNotSaved']> {
  if (run.ran === 0) {
    return null;
  }

  try {
    const locked = await withStoreLock(
      store.folder,
      async () => {
        const read = await readStore(store.folder);

        if (read.kind !== 'store') {
          return;
        }

        await writeCheckFiles(
          store.folder,
          pickCheckSave({
            probed: store.items,
            items: read.store.items,
            prs: read.store.prsUnread === null ? read.store.prs : [],
            run,
            ts: formatTimestamp(nowMs),
          }),
        );
      },
      { waitMs: 0 },
    );

    return locked.kind === 'busy' ? 'lock-held' : null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return 'not-writable';
    }

    throw error;
  }
}
