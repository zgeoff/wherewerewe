import type { ParsedArgs } from '../types.ts';
import type { RefusalScope } from './format-refusal.ts';

// The scope a refusal's Run lines are written in: the --session typed.
export function buildRefusalScope(args: ParsedArgs): RefusalScope {
  return { sessionFlag: args.sessionFlag };
}
