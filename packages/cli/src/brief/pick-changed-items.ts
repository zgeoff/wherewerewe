import type { Item } from '../types.ts';

// The items whose check result differs from the one written with the claim, in items.tsv order. An
// item's result is this read's result unless it is missing or unchecked, and then the last result
// saved. An at_write of `-` takes the first result and counts no change.
export function pickChangedItems(
  items: readonly Item[],
  results: ReadonlyMap<string, string>,
): { readonly item: Item; readonly result: string }[] {
  return items.flatMap((item) => {
    const found = results.get(item.id);
    const result = found === undefined || found === 'unchecked' ? item.last : found;

    return item.check !== null &&
      item.atWrite !== null &&
      result !== null &&
      result !== 'unchecked' &&
      result !== item.atWrite
      ? [{ item, result }]
      : [];
  });
}
