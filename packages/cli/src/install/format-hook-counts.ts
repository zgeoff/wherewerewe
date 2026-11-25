import type { HookMerge } from './merge-hook-entries.ts';

// What a merge did to the hook entries of one file, as one clause.
export function formatHookCounts(
  counts: Extract<HookMerge, { readonly kind: 'merged' }>['counts'],
): string {
  return `${String(counts.added)} hook entries added, ${String(counts.replaced)} replaced, ${String(counts.removed)} removed`;
}
