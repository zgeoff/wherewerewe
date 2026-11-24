import type { Item } from '../types.ts';

// A saved result that differs from the one written with the claim. A result that is missing or
// unchecked never counts.
export function isChangedResult(item: Item): boolean {
  return (
    item.atWrite !== null &&
    item.last !== null &&
    item.last !== 'unchecked' &&
    item.last !== item.atWrite
  );
}
