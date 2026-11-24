import type { Item } from '../types.ts';
import { isChangedResult } from './is-changed-result.ts';

// The ids of the tasks that count as changed: those a read marked, and those whose saved result
// differs from the one written with the claim.
export function collectChangedIDs(
  items: readonly Item[],
  marked: readonly { readonly item: Item }[],
): Set<string> {
  return new Set([
    ...marked.map((change) => change.item.id),
    ...items.filter((item) => item.kind === 'task' && isChangedResult(item)).map((item) => item.id),
  ]);
}
