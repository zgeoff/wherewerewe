import type { PullRequestRow, Store } from '../types.ts';

// Whether an item's check names the pull request, so the row of prs.tsv never shows on its own.
export function isNamedPullRequest(store: Store, row: PullRequestRow): boolean {
  return store.items.some((item) => item.check === `pr:${row.ref}`);
}
