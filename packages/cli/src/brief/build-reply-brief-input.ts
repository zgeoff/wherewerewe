import type { Store } from '../types.ts';
import { buildBaseBriefInput } from './build-base-brief-input.ts';
import type { BriefContext } from './build-base-brief-input.ts';
import { isNamedPullRequest } from './is-named-pull-request.ts';
import { pickChangedItems } from './pick-changed-items.ts';
import type { BriefInput } from './types.ts';

// The brief as a write reply counts its lines, and as the read orders its probes: no probe has run,
// so each tag reads the last result saved, and each open pull request row reads its saved state.
export function buildReplyBriefInput(store: Store, context: BriefContext): BriefInput {
  const checkCount = store.items.filter((item) => item.check !== null).length;

  return {
    ...buildBaseBriefInput(store, context),
    results: new Map(),
    changed: pickChangedItems(store.items, new Map()),
    pullRequests: store.prs
      .filter(
        (row) =>
          row.state !== 'MERGED' && row.state !== 'CLOSED' && !isNamedPullRequest(store, row),
      )
      .map((row) => ({ ref: row.ref, opened: row.opened, result: row.state ?? '-' })),
    checks: checkCount === 0 ? { kind: 'none' } : { kind: 'not-run', count: checkCount },
    resultsNotSaved: null,
    nowHidden: null,
  };
}
