import { match } from 'ts-pattern';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import type { ParsedArgs, RefusalReason, TextTarget } from '../types.ts';

export interface TextCheck {
  readonly target: TextTarget;
  readonly text: string;
  readonly limit: number;
}

// The first problem in the texts, each checked for being empty, one line, within its limit and
// free of a credential, in that order.
export function pickTextRefusal(
  args: ParsedArgs,
  checks: readonly TextCheck[],
  onOtherKind: boolean,
): RefusalReason | null {
  for (const check of checks) {
    const reason = pickOneTextRefusal(args, check, onOtherKind);

    if (reason !== null) {
      return reason;
    }
  }

  return null;
}

function pickOneTextRefusal(
  args: ParsedArgs,
  check: TextCheck,
  onOtherKind: boolean,
): RefusalReason | null {
  const target = check.target;

  return match(findTextProblem(check.text, check.limit))
    .with({ kind: 'empty' }, (): RefusalReason => ({ kind: 'text-empty', args, target }))
    .with({ kind: 'not-one-line' }, (): RefusalReason => ({
      kind: 'text-not-one-line',
      args,
      target,
    }))
    .with({ kind: 'too-long' }, (problem): RefusalReason => ({
      kind: 'text-too-long',
      args,
      target,
      length: problem.length,
      limit: check.limit,
    }))
    .with(null, (): RefusalReason | null => {
      const label = findCredentialMatch(check.text);

      return label === null ? null : { kind: 'credential', args, target, label, onOtherKind };
    })
    .exhaustive();
}
