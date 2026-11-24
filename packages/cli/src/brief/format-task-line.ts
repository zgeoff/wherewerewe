import type { Item, Note } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatCheckResult } from './format-check-result.ts';
import { formatItemLine } from './format-item-line.ts';
import { isBlockedTask } from './is-blocked-task.ts';
import { withOwed } from './with-owed.ts';

export interface TaskLineContext {
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly nowMs: number;
  readonly results: ReadonlyMap<string, string>;
}

// A task's row as the brief prints it: `  <id>  <claim>  [<tag>]`, with the tag of brief.md.
export function formatTaskLine(item: Item, context: TaskLineContext): string {
  const isOwed = context.notes.some((note) => note.id === item.id && note.owed);

  return formatItemLine(item, withOwed(formatTaskTag(item, context), isOwed));
}

function formatTaskTag(item: Item, context: TaskLineContext): string {
  if (isBlockedTask(item, context.items)) {
    return `blocked by ${item.extra.blocked_by ?? ''}${item.check === null ? '' : ` · ${formatCheckResult(item, context.results)}`}`;
  }

  return item.check === null
    ? `no check · ${formatAge(context.nowMs - Date.parse(item.written))}`
    : formatCheckResult(item, context.results);
}
