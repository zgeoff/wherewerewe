import { isSessionName } from '../rules/is-session-name.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';

// The checks of init that read the command line and no store: the name, then the goal's text.
export function pickInitArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const name = args.positionals[0] ?? '';
  const goal = args.values.goal;

  if (!isSessionName(name)) {
    return { kind: 'bad-session-name', args, name };
  }

  if (goal === undefined) {
    return { kind: 'needs-goal', args };
  }

  return pickTextRefusal(
    args,
    [{ target: { label: 'goal', place: { flag: 'goal' } }, text: goal, limit: textLimits.goal }],
    false,
  );
}
