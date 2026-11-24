import type { Kind } from '../types.ts';

// The most open items of each kind a session holds, which a write checks and a heading prints.
export const itemCaps: Readonly<Record<Kind, number>> = {
  task: 30,
  wait: 4,
  rule: 5,
  where: 4,
  ok: 1,
};
