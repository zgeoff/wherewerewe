import type { Grant } from '../types.ts';
import type { GrantOpts } from './types.ts';

// The grant as lists-and-json.md gives it: each group only when it holds a bullet, the scope only
// when the grant has one, and the day the owner gave it left out.
export function buildGrantOpts(grant: Grant | null): GrantOpts | null {
  if (grant === null) {
    return null;
  }

  return {
    ...(grant.may.length === 0 ? {} : { may: grant.may }),
    ...(grant.not.length === 0 ? {} : { not: grant.not }),
    ...(grant.never.length === 0 ? {} : { never: grant.never }),
    ...(grant.scope === null ? {} : { scope: grant.scope }),
    where: grant.where,
    reading: grant.reading,
  };
}
