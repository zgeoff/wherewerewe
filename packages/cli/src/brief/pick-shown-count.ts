import type { Item } from '../types.ts';
import { buildItemSections } from './build-item-sections.ts';
import { isOverBudget } from './is-over-budget.ts';
import { joinBrief } from './join-brief.ts';
import type { BriefBudget, BriefInput } from './types.ts';

// How many task rows print: all of them when they fit, else the most that fit with the count line,
// never fewer than the budget's worst case keeps.
export function pickShownCount(
  input: BriefInput,
  ordered: readonly Item[],
  budget: BriefBudget,
): number {
  const count = ordered.length;

  if (count <= budget.taskRows) {
    return count;
  }

  const isWithin = (shown: number): boolean =>
    !isOverBudget(joinBrief(input, buildItemSections(input, ordered, shown), [], 0), budget);

  if (isWithin(count)) {
    return count;
  }

  for (let shown = count - 1; shown >= budget.taskRows; shown -= 1) {
    if (isWithin(shown)) {
      return shown;
    }
  }

  return budget.taskRows - 1;
}
