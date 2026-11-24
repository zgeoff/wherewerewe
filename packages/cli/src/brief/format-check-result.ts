import type { Item } from '../types.ts';

// What a tag shows for an item with a check: this read's result, unchecked included, then the last
// result saved, then `not checked yet`.
export function formatCheckResult(item: Item, results: ReadonlyMap<string, string>): string {
  return results.get(item.id) ?? item.last ?? 'not checked yet';
}
