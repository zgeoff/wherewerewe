import { isWriteCommand } from '../rules/is-write-command.ts';
import type { ParsedArgs } from '../types.ts';
import type { RunScope } from './settle-refusal.ts';

// The scope a refusal's Run lines are written and checked in: the --session typed, the folder the
// command ran in, and whether the command writes.
export function buildRefusalScope(args: ParsedArgs, cwd: string): RunScope {
  return {
    sessionFlag: args.sessionFlag,
    cwd,
    writes: isWriteCommand(args.command, args.values.paste === true),
  };
}
