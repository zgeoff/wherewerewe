import { countGrantLines } from '../brief/count-grant-lines.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildGrantRefusal } from '../refusals/build-grant-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { countGrantWords } from '../rules/count-grant-words.ts';
import { formatGrantText } from '../rules/format-grant-text.ts';
import { grantLimits } from '../rules/grant-limits.ts';
import type { Grant, ParsedArgs, RefusalReason } from '../types.ts';
import { pickGrantPartsRefusal } from './pick-grant-parts-refusal.ts';
import { pickGrantTextRefusals } from './pick-grant-text-refusals.ts';
import { toGrantWords } from './to-grant-words.ts';
import type { WriteInput, WriteResult } from './types.ts';

// www grant with the owner's words in bullets, or --reading alone. Line breaks in the owner's words
// become one space each before any check. `byOwner` is the terminal test of owner-notes.md, read by
// the caller.
export function pickGrantWrite(input: WriteInput & { readonly byOwner: boolean }): WriteResult {
  const args = input.args;
  const session = input.store.session;
  const partReason = pickGrantNeedsPartRefusal(input) ?? pickReadingNoGrantRefusal(input);
  const reasons = [...(partReason === null ? [] : [partReason]), ...pickGrantTextRefusals(args)];
  const [first, ...rest] = reasons;

  if (first !== undefined) {
    return { kind: 'refused', refusal: buildGrantRefusal(args, [first, ...rest], buildRefusal) };
  }

  const isReadingOnly = !hasBulletFlag(args);
  const ts = formatTimestamp(input.nowMs);
  const by = input.byOwner ? 'owner' : 'agent';
  const reading = args.values.reading ?? '';

  // a reading alone passes the checks only when the session holds a grant, so the fallback never
  // reaches the store
  const kept: Grant = session.grant ?? {
    may: [],
    not: [],
    never: [],
    scope: null,
    reading,
    where: '',
    set: ts,
  };

  const grant: Grant = isReadingOnly
    ? { ...kept, reading }
    : { ...toGrantWords(args), reading, where: args.values.where ?? '', set: ts };

  const bullets = grant.may.length + grant.not.length + grant.never.length;
  const lines = countGrantLines(grant);
  const readingLength = Array.from(grant.reading, (character) => character).length;

  return {
    kind: 'write',
    change: {
      session: { ...session, grant, lastWrite: ts },
      journal: [
        {
          ts,
          op: 'grant',
          id: 'grant',
          by,
          text: formatGrantText(grant),
          why: grant.reading,
          extra: isReadingOnly ? `where=${grant.where};reading=1` : `where=${grant.where}`,
        },
      ],
    },
    reply: (briefLines) =>
      isReadingOnly
        ? `grant reading: ${String(readingLength)} of ${String(grantLimits.reading)}. Brief: ${String(briefLines)} lines.`
        : `grant: ${String(countGrantWords(grant))} of ${String(grantLimits.words)} characters in ${String(bullets)} of ${String(grantLimits.bullets)} bullets on ${String(lines)} of ${String(grantLimits.lines)} lines, reading ${String(readingLength)} of ${String(grantLimits.reading)}. Brief: ${String(briefLines)} lines.`,
  };
}

// No flag at all, or a flag of the grant's words without a bullet, --where and --reading.
function pickGrantNeedsPartRefusal(input: WriteInput): RefusalReason | null {
  return input.args.flags.length === 0
    ? { kind: 'grant-needs-part', args: input.args }
    : pickGrantPartsRefusal(input.args, true);
}

function pickReadingNoGrantRefusal(input: WriteInput): RefusalReason | null {
  return !hasBulletFlag(input.args) && input.store.session.grant === null
    ? { kind: 'grant-reading-no-grant', args: input.args, name: input.store.session.name }
    : null;
}

function hasBulletFlag(args: ParsedArgs): boolean {
  return (
    args.values.may !== undefined ||
    args.values.not !== undefined ||
    args.values.never !== undefined
  );
}
