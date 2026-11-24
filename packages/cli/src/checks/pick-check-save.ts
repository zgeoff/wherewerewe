import type { Item, JournalRow, PullRequestRow } from '../types.ts';
import type { CheckRun } from './types.ts';

export interface CheckSaveInput {
  // the items as the read probed them
  readonly probed: readonly Item[];

  // the items and rows now in the store, read again under the lock
  readonly items: readonly Item[];
  readonly prs: readonly PullRequestRow[];
  readonly run: CheckRun;
  readonly ts: string;
}

export interface CheckSave {
  // null when the file stays as it is
  readonly items: readonly Item[] | null;
  readonly prs: readonly PullRequestRow[] | null;
  readonly journal: readonly JournalRow[];
}

// What a read saves of its results. An item takes a result only when its id, check and written
// time still match what was probed, so a write that ran since wins. A first result adds no changed
// row, and an unchecked result changes nothing.
export function pickCheckSave(input: CheckSaveInput): CheckSave {
  const journal: JournalRow[] = [];
  let isItemsChanged = false;

  const items = input.items.map((item): Item => {
    const result = input.run.results.get(item.id);
    const probed = input.probed.find((candidate) => candidate.id === item.id);

    if (
      result === undefined ||
      result === 'unchecked' ||
      item.check === null ||
      probed?.check !== item.check ||
      probed.written !== item.written
    ) {
      return item;
    }

    const old = item.last ?? item.atWrite;

    if (old !== null && old !== result) {
      journal.push({
        ts: input.ts,
        op: 'changed',
        id: item.id,
        by: 'agent',
        text: `${old} -> ${result}`,
        why: null,
        extra: null,
      });
    }

    if (item.last === result && item.atWrite !== null) {
      return item;
    }

    isItemsChanged = true;

    return { ...item, atWrite: item.atWrite ?? result, last: result };
  });

  const itemIDs = new Set(input.items.map((item) => item.id));

  let isPrsChanged = false;

  const prs = input.prs.map((row): PullRequestRow => {
    const result = itemIDs.has(row.ref) ? undefined : input.run.results.get(row.ref);
    const state = pickState(result);

    if (state === null) {
      return row;
    }

    isPrsChanged = true;

    return { ...row, state, seen: input.ts };
  });

  return {
    items: isItemsChanged ? items : null,
    prs: isPrsChanged ? prs : null,
    journal,
  };
}

function pickState(result: string | undefined): PullRequestRow['state'] {
  if (result === undefined) {
    return null;
  }

  if (result.startsWith('OPEN')) {
    return 'OPEN';
  }

  return result === 'MERGED' || result === 'CLOSED' ? result : null;
}
