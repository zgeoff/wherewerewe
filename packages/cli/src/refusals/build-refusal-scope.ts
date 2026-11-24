import type { ParsedArgs } from '../types.ts';
import type { RunScope } from './settle-refusal.ts';

// The scope a refusal's Run lines are written and checked in: the --session typed and the folder
// the command ran in.
export function buildRefusalScope(args: ParsedArgs, cwd: string): RunScope {
  return { sessionFlag: args.sessionFlag, cwd };
}
