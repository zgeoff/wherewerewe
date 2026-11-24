import { match } from 'ts-pattern';
import type { ParsedArgs, Refusal, RefusalReason } from '../types.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { fixGrantText } from './fix-grant-text.ts';
import { grantPlaceholders } from './grant-placeholders.ts';
import { toPlaceholder } from './to-placeholder.ts';

// One problem prints its own refusal. Several print each problem's lines, then one Run line that
// fixes every text first and adds the missing flags last, so a filled Run line passes. Takes the
// builder of the other refusals, which each problem's lines and text fix come from.
export function buildGrantRefusal(
  args: ParsedArgs,
  reasons: readonly [RefusalReason, ...RefusalReason[]],
  buildReason: (reason: RefusalReason) => Refusal,
): Refusal {
  if (reasons.length === 1) {
    return buildReason(reasons[0]);
  }

  const lines = reasons.flatMap((reason) => buildReason(reason).lines);

  const typed = new Set(args.flags.map((flag) => flag.name));

  const fixed = reasons
    .filter((reason) => !isMissingPart(reason))
    .reduce((spec, reason) => fixGrantText(spec, reason, buildReason), buildRunSpec(args));

  const spec = reasons
    .filter((reason) => isMissingPart(reason))
    .reduce(
      (current, reason) =>
        match(reason)
          .with({ kind: 'grant-reading-no-grant' }, () =>
            current
              .addFlagBefore('reading', 'may', grantPlaceholders.may)
              .addFlagBefore('reading', 'where', toPlaceholder('<where>')),
          )
          .otherwise(() => addGrantFlags(current, typed)),
      fixed,
    );

  return { exitCode: 3, lines, runs: [{ www: spec.toArgv() }] };
}

function isMissingPart(reason: RefusalReason): boolean {
  return reason.kind === 'grant-needs-part' || reason.kind === 'grant-reading-no-grant';
}
