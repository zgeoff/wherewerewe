import type { StatPath } from '../checks/types.ts';

// A stat that holds the event loop for the time, then answers that the path is a folder. No timer
// runs while it holds, so a deadline's timer fires only after the code that called it goes on.
export function buildStubHeldStat(holdMs: number): StatPath {
  return () => {
    const heldAtMs = performance.now();

    while (performance.now() - heldAtMs < holdMs) {
      // held on purpose
    }

    return Promise.resolve({ isDirectory: () => true });
  };
}
