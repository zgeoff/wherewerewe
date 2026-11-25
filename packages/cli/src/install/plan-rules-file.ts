import { codexRuleLine } from './types.ts';
import type { FilePlan } from './types.ts';

// The Codex rules file of its own: missing, it holds the one rule; with exactly that line, it stays;
// with anything else, it is not ours and install leaves it.
export function planRulesFile(before: string | null, shown: string): FilePlan {
  const text = `${codexRuleLine}\n`;

  if (before !== null && before !== text) {
    return { kind: 'refused', reason: 'foreign-rules' };
  }

  return {
    kind: 'text',
    text,
    notices: [`www install: adding ${codexRuleLine} to ${shown}`],
    changedLine: `www install: wrote ${shown}.`,
    sameLine: `www install: ${shown} already holds the rule; nothing changed.`,
  };
}
