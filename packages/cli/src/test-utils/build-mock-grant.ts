import type { Grant } from '../types.ts';

// A grant with no bullet, no scope, the reading "covers it", given in chat on 2026-03-10, with the
// fields the test names laid over it.
export function buildMockGrant(fields: Partial<Grant>): Grant {
  return {
    may: [],
    not: [],
    never: [],
    scope: null,
    reading: 'covers it',
    where: 'chat',
    set: '2026-03-10T09:00:00Z',
    ...fields,
  };
}
