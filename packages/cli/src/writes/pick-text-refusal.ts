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
    const problem = findTextProblem(check.text, check.limit);

    if (problem?.kind === 'empty') {
      return { kind: 'text-empty', args, target: check.target };
    }

    if (problem?.kind === 'not-one-line') {
      return { kind: 'text-not-one-line', args, target: check.target };
    }

    if (problem?.kind === 'too-long') {
      return {
        kind: 'text-too-long',
        args,
        target: check.target,
        length: problem.length,
        limit: check.limit,
      };
    }

    const label = findCredentialMatch(check.text);

    if (label !== null) {
      return { kind: 'credential', args, target: check.target, label, onOtherKind };
    }
  }

  return null;
}
