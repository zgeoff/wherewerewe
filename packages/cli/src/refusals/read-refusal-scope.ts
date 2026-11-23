import type { ParsedArgs } from '../types.ts';
import type { RefusalScope } from './format-refusal.ts';

// The scope a refusal's Run lines are written in: the --session typed, and every word typed.
export function readRefusalScope(args: ParsedArgs): RefusalScope {
  return {
    sessionFlag: args.sessionFlag,
    typedWords: [
      args.command,
      ...args.positionals,
      ...args.flags.flatMap((flag) => (flag.value === null ? [] : [flag.value])),
      ...(args.sessionFlag === null ? [] : [args.sessionFlag]),
    ],
  };
}
