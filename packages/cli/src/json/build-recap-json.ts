import { getSessionDay } from '../brief/get-session-day.ts';
import type { Item, JournalRow, Note, PromiseRow, SessionFile } from '../types.ts';
import { buildGrantOpts } from './build-grant-opts.ts';
import { buildShown } from './build-shown.ts';
import { jsonVersion } from './json-version.ts';
import type { RecapJson } from './types.ts';

export interface RecapJsonInput {
  readonly session: SessionFile;
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly promises: readonly PromiseRow[];

  // the journal rows at or after `fromMs`; null when journal.tsv could not be read. Rows are stamped
  // to the second, so `since` rounds `fromMs` up to the second that keeps the same rows.
  readonly rows: readonly JournalRow[] | null;
  readonly fromMs: number;
  readonly nowMs: number;
}

const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);
const closeOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);

// The recap as JSON, every row whole. With a journal that cannot be read, the count of writes and
// the two lists of rows are null.
export function buildRecapJSON(input: RecapJsonInput): RecapJson {
  const noted = input.notes
    .flatMap((note) => {
      const item = input.items.find((candidate) => candidate.id === note.id);

      return item === undefined ? [] : [{ item, note }];
    })
    .toSorted(
      (first, second) =>
        Number(second.note.owed) - Number(first.note.owed) ||
        Date.parse(second.note.written) - Date.parse(first.note.written),
    );

  const byTime =
    input.rows?.toSorted((first, second) => Date.parse(first.ts) - Date.parse(second.ts)) ?? null;

  return {
    ...jsonVersion,
    session: input.session.name,
    day: getSessionDay(input.session.started, input.nowMs),
    since: new Date(input.fromMs).toISOString(),
    writes:
      input.rows === null
        ? null
        : input.rows.filter(
            (row) => row.op !== 'changed' && (row.by === 'agent' || row.by === 'owner'),
          ).length,
    grant: buildGrantOpts(input.session.grant),
    promises: input.promises.toSorted(
      (first, second) => Date.parse(first.written) - Date.parse(second.written),
    ),
    notes: noted.map((entry) => ({
      item: buildShown({ item: entry.item, notes: input.notes }),
      note: entry.note,
    })),
    otherOpen: input.items
      .filter((item) => !input.notes.some((note) => note.id === item.id))
      .map((item) => item.id),
    decidedSince: byTime === null ? null : byTime.filter((row) => decisionOps.has(row.op)),
    closedSince: byTime === null ? null : byTime.filter((row) => closeOps.has(row.op)),
  };
}
