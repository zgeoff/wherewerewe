import { match } from 'ts-pattern';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { grantLimits } from '../rules/grant-limits.ts';
import type { Refusal, RefusalReason } from '../types.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { grantPlaceholders } from './grant-placeholders.ts';
import { refuse } from './refuse.ts';
import { replaceGrantBullets } from './replace-grant-bullets.ts';
import { replaceText } from './replace-text.ts';
import { toPlaceholder } from './to-placeholder.ts';
import { toRedactedRunWord } from './to-redacted-run-word.ts';

type ApprovalRefusalReason = Extract<
  RefusalReason,
  {
    kind:
      | 'ok-needs-parts'
      | 'ok-standing'
      | 'grant-needs-part'
      | 'grant-reading-no-grant'
      | 'grant-words-too-long'
      | 'grant-too-many-bullets'
      | 'grant-too-many-lines'
      | 'text-has-mark';
  }
>;

const bulletFlags = ['may', 'not', 'never'] as const;

const approvalPlaceholders = {
  quote: toPlaceholder('<their exact words>'),
  who: toPlaceholder('<who>'),
  where: toPlaceholder('<where>'),
  scope: toPlaceholder('<what it covers>'),
} as const;

// The refusals of www ok and www grant that hold the owner's words: what is missing, a standing
// approval that belongs in the grant, and a grant over its bullet cap, its line limit or its 700 characters.
export function buildApprovalRefusal(reason: ApprovalRefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'ok-needs-parts' }, (found) => {
      const added = found.missing.reduce(
        (spec, flag) => spec.addFlag(flag, approvalPlaceholders[flag]),
        buildRunSpec(found.args),
      );

      return refuse(
        "www: refused: an approval needs the owner's exact words, who gave them, where, and what they cover.",
        added.toArgv(),
      );
    })
    .with({ kind: 'ok-standing' }, (found) =>
      refuse(
        "www: refused: lasting permission lives in the grant, in the owner's words whole.",
        buildRunSpec({ ...found.args, command: 'grant', positionals: [] })
          .keepFlags([])
          .addFlag('may', grantPlaceholders.may)
          .addFlag('where', toRedactedRunWord(found.args.values.where ?? 'chat'))
          .addFlag('reading', grantPlaceholders.reading)
          .toArgv(),
      ),
    )
    .with({ kind: 'grant-needs-part' }, (found) => {
      const typed = new Set(found.args.flags.map((flag) => flag.name));

      return refuse(
        "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
        addGrantFlags(buildRunSpec(found.args), typed, bulletFlags).toArgv(),
      );
    })
    .with({ kind: 'grant-reading-no-grant' }, (found) =>
      refuse(
        `www: refused: ${found.name} has no grant, so there is no reading to replace.`,
        buildRunSpec(found.args)
          .addFlagBefore('reading', 'may', grantPlaceholders.may)
          .addFlagBefore('reading', 'where', approvalPlaceholders.where)
          .toArgv(),
      ),
    )
    .with({ kind: 'grant-words-too-long' }, (found) =>
      refuse(
        `www: refused: the grant's words are ${String(found.length)} characters in its bullets and scope, and the limit is ${String(grantLimits.words)}.`,
        replaceGrantBullets(buildRunSpec(found.args), found.args.flags).toArgv(),
      ),
    )
    .with({ kind: 'grant-too-many-bullets' }, (found) =>
      refuse(
        `www: refused: the grant has ${String(found.count)} bullets, and the limit is ${String(grantLimits.bullets)}. Put two parts that belong together in one bullet.`,
        replaceGrantBullets(buildRunSpec(found.args), found.args.flags).toArgv(),
      ),
    )
    .with({ kind: 'grant-too-many-lines' }, (found) =>
      refuse(
        `www: refused: the grant takes ${String(found.lines)} lines in the brief, and the limit is ${String(grantLimits.lines)}. Join short parts that belong together in one bullet, or put a long part in fewer words.`,
        replaceGrantBullets(buildRunSpec(found.args), found.args.flags).toArgv(),
      ),
    )
    .with({ kind: 'text-has-mark' }, (found) => {
      const label = found.target.label;
      const fixed = found.text.replaceAll('•', '-');

      const value =
        fixed === '-' || findCredentialMatch(fixed) !== null ? toPlaceholder(`<${label}>`) : fixed;

      return refuse(
        `www: refused: the ${label} cannot hold •, which the brief prints before each bullet.`,
        replaceText(found.args, found.target, value),
      );
    })
    .exhaustive();
}
