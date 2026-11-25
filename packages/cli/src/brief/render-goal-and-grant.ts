import type { SessionFile } from '../types.ts';
import { formatGoalLines } from './format-goal-lines.ts';
import { renderGrantLines } from './render-grant-lines.ts';

const noGrantLine =
  'GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"';

// The GOAL block and the GRANT block as the brief prints them, the line for no grant included.
// The brief and the hook's injection both print these lines.
export function renderGoalAndGrant(session: SessionFile, nowMs: number): string[] {
  return [
    ...formatGoalLines(session.goal),
    ...(session.grant === null ? [noGrantLine] : renderGrantLines(session.grant, nowMs)),
  ];
}
