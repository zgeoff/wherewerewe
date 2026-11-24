import { countGrantLines } from '../brief/count-grant-lines.ts';
import { countGrantWords } from '../rules/count-grant-words.ts';
import type { GrantWords } from '../rules/count-grant-words.ts';
import { grantLimits } from '../rules/grant-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { TextCheck } from './pick-text-refusal.ts';
import { toGrantWords } from './to-grant-words.ts';

const bulletFlags = ['may', 'not', 'never'] as const;

// The problems in the grant's texts, in the order a refusal prints them. Too many bullets, lines or
// words replace every bullet in the Run line, so each bullet's own problem waits for those fixes.
// Lines are counted last, as counting wraps each bullet: `countLines` is passed for a test to watch.
export function pickGrantTextRefusals(
  args: ParsedArgs,
  countLines: (words: GrantWords) => number = countGrantLines,
): RefusalReason[] {
  const words = toGrantWords(args);
  const count = words.may.length + words.not.length + words.never.length;
  const length = countGrantWords(words);
  const isCounted = count <= grantLimits.bullets && length <= grantLimits.words;
  const lines = isCounted ? countLines(words) : 0;

  const whole: RefusalReason[] = [
    ...(count > grantLimits.bullets
      ? [{ kind: 'grant-too-many-bullets' as const, args, count }]
      : []),
    ...(length > grantLimits.words
      ? [{ kind: 'grant-words-too-long' as const, args, length }]
      : []),
    ...(lines > grantLimits.lines ? [{ kind: 'grant-too-many-lines' as const, args, lines }] : []),
  ];

  const bulletChecks: TextCheck[] =
    whole.length > 0
      ? []
      : bulletFlags.flatMap((flag) =>
          words[flag].map((bullet, occurrence) => ({
            target: { label: 'bullet' as const, place: { flag, occurrence } },
            text: bullet,
            limit: grantLimits.words,
          })),
        );

  const otherChecks: TextCheck[] = [
    ...(words.scope === null
      ? []
      : [
          {
            target: { label: "grant's scope" as const, place: { flag: 'scope' } },
            text: words.scope,
            limit: grantLimits.scope,
          },
        ]),
    ...(args.values.where === undefined
      ? []
      : [
          {
            target: { label: 'where' as const, place: { flag: 'where' } },
            text: args.values.where,
            limit: grantLimits.where,
          },
        ]),
  ];

  const readingCheck: TextCheck[] =
    args.values.reading === undefined
      ? []
      : [
          {
            target: { label: 'reading', place: { flag: 'reading' } },
            text: args.values.reading,
            limit: grantLimits.reading,
          },
        ];

  const where = args.values.where ?? '';

  const separator: RefusalReason[] = /[;=]/u.test(where)
    ? [{ kind: 'extra-has-separator', args, flag: 'where', value: where }]
    : [];

  const textReasons = [...readingCheck, ...bulletChecks, ...otherChecks].flatMap((check) => {
    const reason = pickTextRefusal(args, [check], false);

    return reason === null ? [] : [reason];
  });

  const isWhereRefused = textReasons.some(
    (reason) => 'target' in reason && reason.target.label === 'where',
  );

  // a text with another problem gets that refusal alone, whose Run line replaces it
  const marks: RefusalReason[] = [...readingCheck, ...bulletChecks, ...otherChecks].flatMap(
    (check) =>
      check.text.includes('•') &&
      !textReasons.some((reason) => 'target' in reason && reason.target === check.target)
        ? [{ kind: 'text-has-mark' as const, args, target: check.target, text: check.text }]
        : [],
  );

  return [...whole, ...textReasons, ...marks, ...(isWhereRefused ? [] : separator)];
}
