import type { CheckRun } from '../checks/types.ts';
import type { Store } from '../types.ts';
import { buildBaseBriefInput } from './build-base-brief-input.ts';
import type { BriefContext } from './build-base-brief-input.ts';
import { isNamedPullRequest } from './is-named-pull-request.ts';
import { pickChangedItems } from './pick-changed-items.ts';
import type { BriefInput } from './types.ts';

export interface ReadBriefParts {
  readonly run: CheckRun;
  readonly hidden: BriefInput['nowHidden'];
  readonly saved: BriefInput['resultsNotSaved'];
}

// The brief of a read: this read's results and what they changed, the pull requests it probed,
// whether the results were saved, and why the next step hides.
export function buildReadBriefInput(
  store: Store,
  parts: ReadBriefParts,
  context: BriefContext,
): BriefInput {
  const run = parts.run;

  return {
    ...buildBaseBriefInput(store, context),
    results: run.results,
    changed: pickChangedItems(store.items, run.results),
    pullRequests: store.prs.flatMap((row) => {
      const result = run.results.get(row.ref);

      return result === undefined ||
        isNamedPullRequest(store, row) ||
        ['MERGED', 'CLOSED', 'not found'].includes(result)
        ? []
        : [{ ref: row.ref, opened: row.opened, result }];
    }),
    checks:
      run.ran === 0
        ? { kind: 'none' }
        : {
            kind: 'ran',
            count: run.ran,
            seconds: run.elapsedMs / 1000,
            unchecked:
              run.unchecked === 0 || run.reason === null
                ? null
                : { count: run.unchecked, reason: run.reason },
          },
    resultsNotSaved: parts.saved,
    nowHidden: parts.hidden,
  };
}
