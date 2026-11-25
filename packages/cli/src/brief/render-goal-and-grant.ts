import type { SessionFile } from '../types.ts';
import { formatGoalLines } from './format-goal-lines.ts';
import { renderGrantLines } from './render-grant-lines.ts';
import { wrapBlock } from './wrap-block.ts';

const noGrantLine =
  'GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"';

// The GOAL block, the PIN block when there is a pin, and the GRANT block as the brief prints them,
// the line for no grant included. The brief prints all three; the hook's injection passes no pin.
export function renderGoalAndGrant(
  session: SessionFile,
  nowMs: number,
  pin: string | null,
): string[] {
  return [
    ...formatGoalLines(session.goal),
    ...(pin === null ? [] : wrapBlock(pin, 'PIN   ', ' '.repeat(6))),
    ...(session.grant === null ? [noGrantLine] : renderGrantLines(session.grant, nowMs)),
  ];
}
