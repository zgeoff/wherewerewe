import { wrapBlock } from './wrap-block.ts';

// Wraps the goal at 100 columns by the wrap rule. The first line starts with `GOAL  `, and each
// further line is indented 6.
export function formatGoalLines(goal: string): string[] {
  return wrapBlock(goal, 'GOAL  ', ' '.repeat(6));
}
