import { orderOpenTasks } from './order-open-tasks.ts';
import { pickBriefBudget } from './pick-brief-budget.ts';
import { pickShownCount } from './pick-shown-count.ts';
import type { BriefInput } from './types.ts';

// The ids of the task rows the brief prints before any cut, in order.
export function pickPrintedTaskIDs(input: BriefInput): string[] {
  const ordered = orderOpenTasks(input);

  return ordered
    .slice(0, pickShownCount(input, ordered, pickBriefBudget(input.host)))
    .map((item) => item.id);
}
