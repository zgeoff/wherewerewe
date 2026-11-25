import type { Store } from '../types.ts';
import { pickCheckSave } from './pick-check-save.ts';
import type { CheckRun } from './types.ts';

// The store as a read leaves it after it saves its results: the store it probed, with each result
// the save would apply. No file is read, so a write that landed since the probe is not seen.
export function pickSavedStore(store: Store, run: CheckRun, ts: string): Store {
  const save = pickCheckSave({
    probed: store.items,
    items: store.items,
    prs: store.prsUnread === null ? store.prs : [],
    run,
    ts,
  });

  return { ...store, items: save.items ?? store.items, prs: save.prs ?? store.prs };
}
