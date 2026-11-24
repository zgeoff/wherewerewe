import type { Kind } from '../types.ts';

// The most open items of each kind a session holds, which a write checks and a heading prints.
export const itemCaps: Readonly<Record<Kind, number>> = {
  task: 30,
  wait: 8,
  rule: 15,
  where: 8,
  ok: 1,
};

// The most owner notes a session holds, which a say checks, the owner file allows and the help lists.
export const ownerNoteCap = 2;

// The most open lessons, promises and pieces of the owner's words a session holds.
export const lessonCap = 5;
export const promiseCap = 5;
export const wordsCap = 8;
