import type { Harness } from '../hooks/types.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import { listOurHookEvents } from './list-our-hook-events.ts';
import type { DoctorCheck } from './types.ts';

export interface HookLayer {
  readonly shown: string;
  readonly format: 'json' | 'toml';

  // `null` for a file that does not exist
  readonly text: string | null;
}

// Checks that no event has more than one wherewerewe hook command across the layers a host reads.
// Codex runs hooks of every file it finds, and can run one command twice, which adds 1 to the
// reads of the brief command twice and keeps the gate shut until Stop.
export function checkDuplicateEntries(harness: Harness, layers: readonly HookLayer[]): DoctorCheck {
  const found = layers.flatMap((layer) =>
    listOurHookEvents(layer.text ?? '', layer.format, harness).map((event) => ({
      event,
      shown: layer.shown,
    })),
  );

  const events = [...new Set(found.map((entry) => entry.event))];

  const duplicates = events.flatMap((event) => {
    const where = found.filter((entry) => entry.event === event).map((entry) => entry.shown);

    return where.length > 1
      ? [
          `www doctor: ${event} runs wherewerewe hook ${harness} ${String(where.length)} times: ${where.join(', ')}.`,
        ]
      : [];
  });

  if (duplicates.length > 0) {
    return buildFailedCheck([...duplicates, 'Remove all but one of them.']);
  }

  return { isOk: true, lines: [`ok: no ${harness} event runs wherewerewe hook twice`] };
}
