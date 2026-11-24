import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickOnRefusal } from './pick-on-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

export function pickDecision(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const choice = args.positionals[0] ?? '';
  const why = args.values.why ?? null;
  const on = args.values.on;
  const replaces = args.values.replaces;
  const who = args.values.who ?? 'agent';
  const argsReason = pickDecisionArgsRefusal(args);

  if (argsReason !== null) {
    return refuse(argsReason);
  }

  // The journal index skips an id past the safe integers, so it could never count past one.
  const reason =
    input.journal.lastDecisionNumber >= Number.MAX_SAFE_INTEGER
      ? ({
          kind: 'decision-numbers-used-up',
          lastNumber: input.journal.lastDecisionNumber,
        } satisfies RefusalReason)
      : (pickOnRefusal(input, on) ?? pickReplacesRefusal(input, replaces, who));

  if (reason !== null) {
    return refuse(reason);
  }

  const ts = formatTimestamp(input.nowMs);
  const id = `d-${String(input.journal.lastDecisionNumber + 1)}`;
  const isRuledOut = args.values['ruled-out'] === true;

  const extra = [
    ...(on === undefined ? [] : [`on=${on}`]),
    `who=${who}`,
    ...(replaces === undefined ? [] : [`replaces=${replaces}`]),
  ].join(';');

  return {
    kind: 'write',
    change: {
      session: { ...store.session, lastWrite: ts },
      journal: [
        {
          ts,
          op: isRuledOut ? 'ruled-out' : 'decide',
          id,
          by: 'agent',
          text: choice,
          why,
          extra,
        },
      ],
    },
    reply: (figure) =>
      `${id}  ${isRuledOut ? 'ruled out' : 'decision'}${on === undefined ? '' : ` on ${on}`}. Read it with: www show ${on ?? id}. ${formatBriefLine(figure)}`,
  };
}

// The checks that read the command line and no store: the decision's text, its reason, then --who.
export function pickDecisionArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const choice = args.positionals[0] ?? '';
  const why = args.values.why;
  const who = args.values.who ?? 'agent';

  const choiceReason = pickTextRefusal(
    args,
    [
      {
        target: { label: 'decision', place: { positional: 0 } },
        text: choice,
        limit: textLimits.decision,
      },
    ],
    false,
  );

  if (choiceReason !== null) {
    return choiceReason;
  }

  if (why === undefined) {
    return { kind: 'decide-needs-why', args };
  }

  const whyReason = pickTextRefusal(
    args,
    [{ target: { label: 'reason', place: { flag: 'why' } }, text: why, limit: textLimits.why }],
    false,
  );

  if (whyReason !== null) {
    return whyReason;
  }

  return who === 'owner' || who === 'agent' ? null : { kind: 'bad-decision-who', args };
}

function refuse(reason: RefusalReason): WriteResult {
  return { kind: 'refused', refusal: buildRefusal(reason) };
}

function pickReplacesRefusal(
  input: WriteInput,
  replaces: string | undefined,
  who: string,
): RefusalReason | null {
  if (replaces === undefined) {
    return null;
  }

  const replaced = input.journal.decisions.get(replaces);

  if (replaced === undefined) {
    return {
      kind: 'no-such-decision',
      value: replaces,
      lastNumber: input.journal.lastDecisionNumber,
    };
  }

  return replaced.who === 'owner' && who !== 'owner'
    ? { kind: 'decision-is-owners', id: replaces }
    : null;
}
