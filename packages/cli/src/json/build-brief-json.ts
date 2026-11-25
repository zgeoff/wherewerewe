import { collectDecisionRowsInForce } from '../brief/collect-decision-rows-in-force.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import { orderOpenTasks } from '../brief/order-open-tasks.ts';
import { pickBriefLimit } from '../brief/pick-brief-limit.ts';
import type { BriefInput } from '../brief/types.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import type { Item, JournalRow, PullRequestRow } from '../types.ts';
import { buildGrantOpts } from './build-grant-opts.ts';
import { buildShown } from './build-shown.ts';
import { jsonVersion } from './json-version.ts';
import type { BriefJson, Shown } from './types.ts';

export interface BriefJsonInput {
  // the brief of the read, after its probes
  readonly brief: BriefInput;

  // the rows of prs.tsv that parse
  readonly prs: readonly PullRequestRow[];

  // every decide and ruled-out row of the journal
  readonly decisionRows: readonly JournalRow[];

  // the figure a write reply gives on the store as the read leaves it
  readonly estimate: number;
}

// The brief as JSON: every open row whole, none cut, each item's last result as this read's tag
// shows it. `open` holds the items of items.tsv in the order their sections print.
export function buildBriefJSON(input: BriefJsonInput): BriefJson {
  const brief = input.brief;
  const session = brief.session;
  const items = brief.items.map((item) => toReadItem(item, brief.results));
  const tasks = orderOpenTasks(brief).map((task) => toReadItem(task, brief.results));
  const ofKind = (kind: Item['kind']): Item[] => items.filter((item) => item.kind === kind);

  const open: Shown[] = [
    ...tasks,
    ...ofKind('wait'),
    ...ofKind('ok'),
    ...ofKind('rule'),
    ...ofKind('where'),
  ].map((item) => buildShown({ item, notes: brief.notes }));

  return {
    ...jsonVersion,
    session: session.name,
    day: getSessionDay(session.started, brief.nowMs),
    host: brief.host ?? 'none',
    limit: pickBriefLimit(brief.host),
    estimate: input.estimate,
    goal: session.goal,
    grant: buildGrantOpts(session.grant),
    ownerNotes: brief.ownerNotes,
    words: brief.words.toSorted((first, second) => first.written.localeCompare(second.written)),
    changed: brief.changed.map((change) => ({
      id: change.item.id,
      was: change.item.atWrite ?? '',
      now: change.result,
    })),
    focus: session.now,
    next: session.now === null || brief.nowHidden !== null ? null : session.nowNext,
    open,
    lessons: brief.lessons.toSorted((first, second) => first.written.localeCompare(second.written)),
    promises: brief.promises.toSorted((first, second) =>
      first.written.localeCompare(second.written),
    ),
    decisions: collectDecisionRowsInForce(input.decisionRows),
    prs: input.prs.flatMap((row) => {
      const found = brief.pullRequests.find((candidate) => candidate.ref === row.ref);

      return found === undefined ? [] : [toReadPullRequest(row, found.result, brief.nowMs)];
    }),
  };
}

// The item with the result its tag shows: this read's, then the last saved.
function toReadItem(item: Item, results: ReadonlyMap<string, string>): Item {
  return item.check === null ? item : { ...item, last: results.get(item.id) ?? item.last };
}

function toReadPullRequest(row: PullRequestRow, result: string, nowMs: number): PullRequestRow {
  const [word] = result.split(' ');
  const state = word === 'OPEN' || word === 'MERGED' || word === 'CLOSED' ? word : row.state;

  return state === row.state ? row : { ...row, state, seen: formatTimestamp(nowMs) };
}
