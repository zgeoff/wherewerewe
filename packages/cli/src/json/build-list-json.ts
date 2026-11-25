import { collectChangedIDs } from '../brief/collect-changed-ids.ts';
import { collectDecisionRowsInForce } from '../brief/collect-decision-rows-in-force.ts';
import { orderTasks } from '../brief/order-tasks.ts';
import type { BriefInput } from '../brief/types.ts';
import type { ListKind } from '../rules/list-kinds.ts';
import type { Item, JournalRow, Note, PullRequestRow } from '../types.ts';
import { buildShown } from './build-shown.ts';
import { jsonVersion } from './json-version.ts';
import type { ListJson, Shown } from './types.ts';

export interface ListJsonInput {
  // the brief of a read that probed nothing, so each tag shows the last result saved
  readonly brief: BriefInput;

  // the rows of prs.tsv that parse
  readonly prs: readonly PullRequestRow[];

  // every decide and ruled-out row of the journal
  readonly decisionRows: readonly JournalRow[];
}

// The rows the text form prints for one kind, whole.
export function buildListJSON(kind: ListKind, input: ListJsonInput): ListJson {
  const brief = input.brief;

  if (kind === 'decisions') {
    return {
      ...jsonVersion,
      kind,
      rows: collectDecisionRowsInForce(input.decisionRows),
    };
  }

  if (kind === 'prs') {
    return {
      ...jsonVersion,
      kind,
      rows: input.prs.filter((row) =>
        brief.pullRequests.some((candidate) => candidate.ref === row.ref),
      ),
    };
  }

  if (kind === 'notes') {
    return { ...jsonVersion, kind, rows: collectNotes(brief) };
  }

  return { ...jsonVersion, kind, rows: collectShown(kind, brief) };
}

// Every open item's note, owed first, then the newest, a tie in notes.tsv order.
function collectNotes(brief: BriefInput): Note[] {
  return brief.notes
    .flatMap((note, row) =>
      brief.items.some((item) => item.id === note.id) ? [{ note, row }] : [],
    )
    .toSorted(
      (first, second) =>
        Number(second.note.owed) - Number(first.note.owed) ||
        Date.parse(second.note.written) - Date.parse(first.note.written) ||
        first.row - second.row,
    )
    .map((entry) => entry.note);
}

function collectShown(
  kind: Exclude<ListKind, 'decisions' | 'prs' | 'notes'>,
  brief: BriefInput,
): Shown[] {
  if (kind === 'tasks') {
    return orderTasks({
      items: brief.items,
      notes: brief.notes,
      focus: brief.session.now,
      changedIDs: collectChangedIDs(brief.items, []),
    }).map((item) => buildShown({ item, notes: brief.notes }));
  }

  if (kind === 'lessons' || kind === 'promises' || kind === 'words') {
    return collectFileShown(kind, brief);
  }

  const itemKind = { waits: 'wait', approvals: 'ok', rules: 'rule', where: 'where' }[kind];

  return brief.items
    .filter((item: Item) => item.kind === itemKind)
    .map((item) => buildShown({ item, notes: brief.notes }));
}

function collectFileShown(kind: 'lessons' | 'promises' | 'words', brief: BriefInput): Shown[] {
  if (kind === 'lessons') {
    return brief.lessons
      .toSorted((first, second) => first.written.localeCompare(second.written))
      .map((row) => buildShown({ lesson: row }));
  }

  if (kind === 'promises') {
    return brief.promises
      .toSorted((first, second) => first.written.localeCompare(second.written))
      .map((row) => buildShown({ promise: row }));
  }

  return brief.words
    .toSorted((first, second) => first.written.localeCompare(second.written))
    .map((row) => buildShown({ words: row }));
}
