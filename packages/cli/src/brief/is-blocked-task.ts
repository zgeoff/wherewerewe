import { canBlock } from '../rules/can-block.ts';
import type { Item } from '../types.ts';

// A task is blocked when its blocked_by names an open item that can block.
export function isBlockedTask(item: Item, items: readonly Item[]): boolean {
  const blocker = item.extra.blocked_by;

  return (
    blocker !== undefined && items.some((other) => other.id === blocker && canBlock(other.kind))
  );
}
