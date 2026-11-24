import type { Item, Note } from '../types.ts';
import { isBlockedTask } from './is-blocked-task.ts';

export interface OrderTasksInput {
  // every open item, in items.tsv order
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly focus: string | null;
  readonly changedIDs: ReadonlySet<string>;
}

// The order the brief and `www show` print open tasks in: the item in focus, the tasks whose check
// result changed, the blocked or owed ones, then the rest. Within a group the newest `written`
// comes first, and on a tie the later row of items.tsv.
export function orderTasks(input: OrderTasksInput): Item[] {
  const owedIDs = new Set(input.notes.filter((note) => note.owed).map((note) => note.id));

  const ranked = input.items.flatMap((item, row) => {
    if (item.kind !== 'task') {
      return [];
    }

    const group = pickGroup(item, input, owedIDs);

    return [{ item, row, group }];
  });

  return ranked
    .toSorted(
      (first, second) =>
        first.group - second.group ||
        Date.parse(second.item.written) - Date.parse(first.item.written) ||
        second.row - first.row,
    )
    .map((entry) => entry.item);
}

function pickGroup(item: Item, input: OrderTasksInput, owedIDs: ReadonlySet<string>): number {
  if (item.id === input.focus) {
    return 0;
  }

  if (input.changedIDs.has(item.id)) {
    return 1;
  }

  return isBlockedTask(item, input.items) || owedIDs.has(item.id) ? 2 : 3;
}
