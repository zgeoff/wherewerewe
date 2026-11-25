import type { HookEntry } from './build-hook-entries.ts';
import { formatHookCounts } from './format-hook-counts.ts';
import { mergeHookEntries } from './merge-hook-entries.ts';
import type { FilePlan } from './types.ts';

// The Codex hooks file with the five hook entries in place.
export function planCodexHooks(
  before: string | null,
  entries: readonly HookEntry[],
  shown: string,
): FilePlan {
  const hooks = mergeHookEntries(before, 'codex', entries);

  if (hooks.kind === 'unreadable') {
    return { kind: 'refused', reason: 'unreadable' };
  }

  return {
    kind: 'text',
    text: hooks.text,
    notices: [],
    changedLine:
      before === null
        ? `www install: created ${shown} with ${String(entries.length)} hook entries.`
        : `www install: updated ${shown}: ${formatHookCounts(hooks.counts)}.`,
    sameLine: `www install: ${shown} already holds every entry; nothing changed.`,
  };
}
