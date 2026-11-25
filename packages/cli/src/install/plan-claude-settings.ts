import type { HookEntry } from './build-hook-entries.ts';
import { formatHookCounts } from './format-hook-counts.ts';
import { mergeAllowRule } from './merge-allow-rule.ts';
import { mergeHookEntries } from './merge-hook-entries.ts';
import { allowRule } from './types.ts';
import type { FilePlan } from './types.ts';

// The Claude Code settings file with the six hook entries and the allow rule in place.
export function planClaudeSettings(
  before: string | null,
  entries: readonly HookEntry[],
  shown: string,
): FilePlan {
  const hooks = mergeHookEntries(before, 'claude', entries);

  if (hooks.kind === 'unreadable') {
    return { kind: 'refused', reason: 'unreadable' };
  }

  const allow = mergeAllowRule(hooks.text, allowRule);

  if (allow.kind === 'unreadable') {
    return { kind: 'refused', reason: 'unreadable' };
  }

  return {
    kind: 'text',
    text: allow.text,
    notices: allow.isAdded
      ? [`www install: adding "${allowRule}" to permissions.allow in ${shown}`]
      : [],
    changedLine:
      before === null
        ? `www install: created ${shown} with ${String(entries.length)} hook entries and the allow rule.`
        : `www install: updated ${shown}: ${formatHookCounts(hooks.counts)}.`,
    sameLine: `www install: ${shown} already holds every entry; nothing changed.`,
  };
}
