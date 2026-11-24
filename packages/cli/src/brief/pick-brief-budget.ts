import type { BriefBudget } from './types.ts';

// The brief's size limit for the agent that reads it. Codex puts about 2,500 tokens of hook output
// into context; Claude Code puts 10,000 characters, and past that only a 2,000-character preview.
// A reader with no known host gets the Codex budget, which fits both.
export function pickBriefBudget(host: 'claude' | 'codex' | null): BriefBudget {
  return host === 'claude'
    ? { maxLines: 82, maxCharacters: 9000, taskRows: 15 }
    : { maxLines: 73, maxCharacters: 7200, taskRows: 6 };
}
