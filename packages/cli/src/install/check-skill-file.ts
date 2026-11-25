import { readSkillMark } from '../skill/read-skill-mark.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks that a host's skill file is the www skill of this binary: the text that `renderSkill`
// gives for this version, not an older version's and not an edited or hand-written file.
export function checkSkillFile(text: string | null, rendered: string, shown: string): DoctorCheck {
  if (text === rendered) {
    return { isOk: true, lines: [`ok: ${shown} is the www skill of this binary`] };
  }

  const mark = text === null ? null : readSkillMark(text);
  const isOurs = mark?.bodyMatches === true || text === null;

  return buildFailedCheck([
    `www doctor: ${shown} is not the www skill of this binary.`,
    isOurs ? 'Run: www install' : 'Run: www install --replace-skill',
  ]);
}
