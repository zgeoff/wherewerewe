import type { Kind } from '../types.ts';

// The most open items of each kind a session holds, which a write checks and a heading prints.
export const itemCaps: Readonly<Record<Kind, number>> = {
  task: 30,
  wait: 4,
  rule: 5,
  where: 4,
  ok: 1,
};

// The most owner notes a session holds, which a say checks, the owner file allows and the help lists.
export const ownerNoteCap = 2;
