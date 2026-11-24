import { buildItemSections } from './build-item-sections.ts';
import { isOverBudget } from './is-over-budget.ts';
import { joinBrief } from './join-brief.ts';
import { orderOpenTasks } from './order-open-tasks.ts';
import { pickBriefBudget } from './pick-brief-budget.ts';
import { pickShownCount } from './pick-shown-count.ts';
import type { BriefInput, ItemLine, ItemSection } from './types.ts';

// Renders every section of the brief in its order. OPEN prints the tasks that fit the host's budget
// and counts the rest. A brief still over the budget loses item lines from the bottom up, and says
// so; the item in focus and everything outside the item sections are never cut.
export function renderBrief(input: BriefInput): string {
  const budget = pickBriefBudget(input.host);
  const ordered = orderOpenTasks(input);
  const shown = pickShownCount(input, ordered, budget);
  const sections = buildItemSections(input, ordered, shown);
  const cutOrder = [5, 4, 3, 2, 1, 0];
  const cuts: boolean[][] = sections.map((section) => section.lines.map(() => false));
  let cutCount = 0;
  let text = joinBrief(input, sections, cuts, cutCount);

  while (isOverBudget(text, budget)) {
    const target = findCutTarget(input, sections, cuts, cutOrder);

    if (target === null) {
      break;
    }

    const row = cuts[target.section];

    if (row !== undefined) {
      row[target.line] = true;
    }

    cutCount += 1;
    text = joinBrief(input, sections, cuts, cutCount);
  }

  return text;
}

function findCutTarget(
  input: BriefInput,
  sections: readonly ItemSection[],
  cuts: readonly (readonly boolean[])[],
  cutOrder: readonly number[],
): { readonly section: number; readonly line: number } | null {
  for (const sectionIndex of cutOrder) {
    const lines: readonly ItemLine[] = sections[sectionIndex]?.lines ?? [];

    const line = lines.findLastIndex(
      (candidate, index) =>
        cuts[sectionIndex]?.[index] === false &&
        (candidate.id === null || candidate.id !== input.session.now),
    );

    if (line !== -1) {
      return { section: sectionIndex, line };
    }
  }

  return null;
}
