import type { BriefBudget } from './types.ts';

// True when the text has more characters or lines than the budget allows.
export function isOverBudget(text: string, budget: BriefBudget): boolean {
  return countCharacters(text) > budget.maxCharacters || countLines(text) > budget.maxLines;
}

function countCharacters(text: string): number {
  return Array.from(text, (character) => character).length;
}

function countLines(text: string): number {
  return text.split('\n').length - 1;
}
