import type { Item } from '../types.ts';
import { collectChangedIDs } from './collect-changed-ids.ts';
import { orderTasks } from './order-tasks.ts';
import type { BriefInput } from './types.ts';

// The open tasks in the order the brief prints them.
export function orderOpenTasks(input: BriefInput): Item[] {
  return orderTasks({
    items: input.items,
    notes: input.notes,
    focus: input.session.now,
    changedIDs: collectChangedIDs(input.items, input.changed),
  });
}
