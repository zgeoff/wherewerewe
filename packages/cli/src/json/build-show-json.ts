import { collectChangedIDs } from '../brief/collect-changed-ids.ts';
import { orderTasks } from '../brief/order-tasks.ts';
import { formatFailingNames } from '../reads/format-failing-names.ts';
import type { CheckNow } from '../reads/render-show.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow, Store } from '../types.ts';
import { buildGrantOpts } from './build-grant-opts.ts';
import { buildShown } from './build-shown.ts';
import { jsonVersion } from './json-version.ts';
import type { ShowJson, Shown } from './types.ts';

export interface ShowJsonInput {
  // the id shown, or null for every open task
  readonly id: string | null;
  readonly store: Store;

  // the journal rows show reads for the id: its own rows and the decisions about it. With no id,
  // the decide rows.
  readonly rows: readonly JournalRow[];

  // what each item row with the id found just now, in file order; null for an item with no check
  readonly checkNows: readonly (CheckNow | null)[];
}

const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);
const closeOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);

// What `www show` prints as JSON: one subject for an id, with its journal rows, or every open task
// with no id. A closed item, an id with journal rows only and an id with no row show no subject.
export function buildShowJSON(input: ShowJsonInput): ShowJson {
  const store = input.store;

  if (input.id === null) {
    const tasks = orderTasks({
      items: store.items,
      notes: store.notes,
      focus: store.session.now,
      changedIDs: collectChangedIDs(store.items, []),
    });

    return {
      ...jsonVersion,
      subjects: tasks.map((task) =>
        toSubject({
          shown: buildShown({ item: task, notes: store.notes }),
          checkNow: null,
          rows: input.rows,
          id: task.id,
          journal: null,
        }),
      ),
    };
  }

  const id = input.id;
  const own = input.rows.filter((row) => row.id === id);

  if (id === 'grant') {
    return {
      ...jsonVersion,
      subjects: [
        {
          kind: 'grant',
          row: buildGrantOpts(store.session.grant),
          journal: own.filter((row) => row.op === 'grant'),
        },
      ],
    };
  }

  const open = [
    ...store.items
      .filter((item) => item.id === id)
      .map((item, index) =>
        toSubject({
          shown: buildShown({ item, notes: store.notes }),
          checkNow: input.checkNows[index] ?? null,
          rows: input.rows,
          id,
          journal: own,
        }),
      ),
    ...collectFileShown(store, id).map((shown) =>
      toSubject({ shown, checkNow: null, rows: input.rows, id, journal: own }),
    ),
  ];

  if (open.length > 0) {
    return { ...jsonVersion, subjects: open };
  }

  const isClosed = own.some((row) => closeOps.has(row.op));
  const decision = own.find((row) => decisionOps.has(row.op));

  if (!isClosed && decision !== undefined) {
    return { ...jsonVersion, subjects: [{ kind: 'decision', row: decision, journal: own }] };
  }

  return { ...jsonVersion, subjects: [] };
}

interface SubjectInput {
  readonly shown: Shown;
  readonly checkNow: CheckNow | null;
  readonly rows: readonly JournalRow[];
  readonly id: string;
  readonly journal: readonly JournalRow[] | null;
}

function toSubject(input: SubjectInput): ShowJson['subjects'][number] {
  const checkNow = input.checkNow;
  const isOpenResult = checkNow !== null && checkNow.result === 'OPEN failing';

  return {
    ...input.shown,
    checkedNow: checkNow === null ? null : checkNow.result,
    failingChecks: isOpenResult ? formatFailingNames(checkNow.failing) : [],
    decisions: input.rows
      .filter((row) => decisionOps.has(row.op) && findExtraValue(row.extra, 'on') === input.id)
      .map((row) => row.id),
    journal: input.journal,
  };
}

function collectFileShown(store: Store, id: string): Shown[] {
  return [
    ...store.lessons.filter((row) => row.id === id).map((row) => buildShown({ lesson: row })),
    ...store.promises.filter((row) => row.id === id).map((row) => buildShown({ promise: row })),
    ...store.words.filter((row) => row.id === id).map((row) => buildShown({ words: row })),
  ];
}
