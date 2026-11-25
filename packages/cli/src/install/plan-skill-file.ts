import { readSkillMark } from '../skill/read-skill-mark.ts';
import type { FilePlan } from './types.ts';

// The skill file at one host's path: the rendered text replaces a missing file and a file this tool
// wrote and nobody edited, of any version. Any other file is not ours, and install leaves it
// unless `isReplacing`, when the caller moves it aside first.
export function planSkillFile(
  before: string | null,
  rendered: string,
  shown: string,
  isReplacing: boolean,
): FilePlan {
  const mark = before === null ? null : readSkillMark(before);

  if (before !== null && !isReplacing && (mark === null || !mark.bodyMatches)) {
    return { kind: 'refused', reason: 'foreign-skill' };
  }

  return {
    kind: 'text',
    text: rendered,
    notices: [],
    changedLine: `www install: wrote ${shown}.`,
    sameLine: `www install: ${shown} already holds this version's skill; nothing changed.`,
  };
}
