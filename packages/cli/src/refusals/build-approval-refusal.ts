import { match } from 'ts-pattern';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Refusal, RefusalReason } from '../types.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { grantPlaceholders } from './grant-placeholders.ts';
import { refuse } from './refuse.ts';

type ApprovalRefusalReason = Extract<
  RefusalReason,
  {
    kind:
      | 'ok-needs-parts'
      | 'ok-standing'
      | 'grant-needs-part'
      | 'grant-reading-no-grant'
      | 'grant-words-too-long';
  }
>;

const approvalPlaceholders = {
  quote: '<their exact words>',
  who: '<who>',
  where: '<where>',
  scope: '<what it covers>',
} as const;

// The refusals of www ok and www grant that hold the owner's words: what is missing, a standing
// approval that belongs in the grant, and a grant text over its limit.
export function buildApprovalRefusal(reason: ApprovalRefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'ok-needs-parts' }, (found) => {
      const added = found.missing.reduce(
        (spec, flag) => spec.addFlag(flag, approvalPlaceholders[flag]),
        buildRunSpec(found.args).dropFlag('once'),
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
          .addFlag('quote', grantPlaceholders.quote)
          .addFlag('where', redactCredential(found.args.values.where ?? 'chat'))
          .addFlag('reading', grantPlaceholders.reading)
          .toArgv(),
      ),
    )
    .with({ kind: 'grant-needs-part' }, (found) => {
      const typed = new Set(found.args.flags.map((flag) => flag.name));

      return refuse(
        "www: refused: a grant needs the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
        addGrantFlags(buildRunSpec(found.args), typed).toArgv(),
      );
    })
    .with({ kind: 'grant-reading-no-grant' }, (found) =>
      refuse(
        `www: refused: ${found.name} has no grant, so there is no reading to replace.`,
        buildRunSpec(found.args)
          .addFlagBefore('reading', 'quote', grantPlaceholders.quote)
          .addFlagBefore('reading', 'where', '<where>')
          .toArgv(),
      ),
    )
    .with({ kind: 'grant-words-too-long' }, (found) =>
      refuse(
        `www: refused: the grant's words are ${String(found.length)} characters, and the limit is 700. The grant holds the owner's words whole, so it takes a statement of at most 700 characters.`,
        buildRunSpec(found.args)
          .replaceFlag('quote', "<the owner's words, at most 700 characters>")
          .toArgv(),
      ),
    )
    .exhaustive();
}
