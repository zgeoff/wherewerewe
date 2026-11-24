import type { Store } from '../types.ts';
import type { BriefInput } from './types.ts';

// What the CLI passes in this slice: no changed rows or pull requests, and no check run.
export function buildBriefInput(
  store: Store,
  nowMs: number,
  sessionFlag: string | null,
  host: 'claude' | 'codex' | null,
): BriefInput {
  const checkCount = store.items.filter((item) => item.check !== null).length;

  return {
    session: store.session,
    items: store.items,
    notes: store.notes,
    ownerNotes: store.ownerNotes,
    changed: [],
    pullRequests: [],
    checks: checkCount === 0 ? { kind: 'none' } : { kind: 'not-run', count: checkCount },
    resultsNotSaved: null,
    nowMs,
    sessionFlag,
    host,
  };
}
