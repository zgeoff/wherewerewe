import { match } from 'ts-pattern';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import type { ParsedArgs, RefusalReason, TextTarget } from '../types.ts';

export interface TextCheck {
  readonly target: TextTarget;
  readonly text: string;
  readonly limit: number;
}

// The first credential among the texts, then the first other problem: each text checked for being
// empty, one line and within its limit, in that order. A credential comes first, so no refusal that
// prints a text, a limit refusal included, prints a secret.
export function pickTextRefusal(
  args: ParsedArgs,
  checks: readonly TextCheck[],
  onOtherKind: boolean,
): RefusalReason | null {
  const credential = pickCredentialRefusal(args, checks, onOtherKind);

  if (credential !== null) {
    return credential;
  }

  for (const check of checks) {
    const reason = pickOneTextRefusal(args, check);

    if (reason !== null) {
      return reason;
    }
  }

  return null;
}

// The first of the texts that looks like a credential. A caller whose own refusal would print a
// text, such as one for a separator, runs this first.
export function pickCredentialRefusal(
  args: ParsedArgs,
  checks: readonly TextCheck[],
  onOtherKind: boolean,
): RefusalReason | null {
  for (const check of checks) {
    const label = findCredentialMatch(check.text);

    if (label !== null) {
      return { kind: 'credential', args, target: check.target, label, onOtherKind };
    }
  }

  return null;
}

function pickOneTextRefusal(args: ParsedArgs, check: TextCheck): RefusalReason | null {
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
    .with(null, (): null => null)
    .exhaustive();
}
