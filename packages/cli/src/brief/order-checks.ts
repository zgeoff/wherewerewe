import type { Item, Note } from '../types.ts';
import { collectChangedIDs } from './collect-changed-ids.ts';
import { orderTasks } from './order-tasks.ts';

export interface OrderChecksInput {
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly focus: string | null;
  readonly printedTaskIDs: readonly string[];
  readonly pullRequests: readonly { readonly ref: string }[];
}

// The order a read starts its probes in, at most 8 at once until the 5 s deadline: the item in
// focus, the printed tasks, the waits and where items, the pull request rows, then the tasks the
// brief leaves out. Only items with a check appear.
export function orderChecks(input: OrderChecksInput): string[] {
  const checked = new Set(input.items.filter((item) => item.check !== null).map((item) => item.id));
  const printed = new Set(input.printedTaskIDs);

  const ofKind = (kinds: readonly Item['kind'][]): string[] =>
    input.items.filter((item) => kinds.includes(item.kind)).map((item) => item.id);

  const leftOut = orderTasks({
    items: input.items,
    notes: input.notes,
    focus: input.focus,
    changedIDs: collectChangedIDs(input.items, []),
  })
    .filter((item) => !printed.has(item.id))
    .map((item) => item.id);

  const ordered = [
    ...(input.focus === null ? [] : [input.focus]),
    ...input.printedTaskIDs,
    ...ofKind(['wait', 'where']),
    ...input.pullRequests.map((pullRequest) => pullRequest.ref),
    ...leftOut,
  ];

  return ordered.filter(
    (id, index) => ordered.indexOf(id) === index && isChecked(id, checked, input),
  );
}

function isChecked(id: string, checked: ReadonlySet<string>, input: OrderChecksInput): boolean {
  return checked.has(id) || input.pullRequests.some((pullRequest) => pullRequest.ref === id);
}
