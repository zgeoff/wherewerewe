import type { Item, Note } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatItemLine, withOwed } from './format-item-line.ts';
import { isBlockedTask } from './is-blocked-task.ts';

// A task's row as the brief prints it: `  <id>  <claim>  [<tag>]`, with the tag of brief.md.
export function formatTaskLine(
  item: Item,
  items: readonly Item[],
  notes: readonly Note[],
  nowMs: number,
): string {
  const isOwed = notes.some((note) => note.id === item.id && note.owed);

  return formatItemLine(item, withOwed(formatTaskTag(item, items, nowMs), isOwed));
}

function formatTaskTag(item: Item, items: readonly Item[], nowMs: number): string {
  if (isBlockedTask(item, items)) {
    return `blocked by ${item.extra.blocked_by ?? ''}${item.check === null ? '' : ` · ${item.last ?? 'not checked yet'}`}`;
  }

  return item.check === null
    ? `no check · ${formatAge(nowMs - Date.parse(item.written))}`
    : (item.last ?? 'not checked yet');
}
