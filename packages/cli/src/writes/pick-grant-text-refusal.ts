import { normaliseWords } from '../rules/normalise-words.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { TextCheck } from './pick-text-refusal.ts';

const wordsLimit = 700;
const readingLimit = 200;
const whereLimit = 16;

// The limits of the grant's texts, for each flag typed: the words first, then the reading, then
// the words and --where for their other rules.
export function pickGrantTextRefusal(args: ParsedArgs): RefusalReason | null {
  const words = args.values.quote === undefined ? undefined : normaliseWords(args.values.quote);

  if (words !== undefined && [...words].length > wordsLimit) {
    return { kind: 'grant-words-too-long', args, length: [...words].length };
  }

  const checks: TextCheck[] = [
    ...(args.values.reading === undefined
      ? []
      : [
          {
            target: { label: 'reading' as const, place: { flag: 'reading' } },
            text: args.values.reading,
            limit: readingLimit,
          },
        ]),
    ...(words === undefined
      ? []
      : [
          {
            target: { label: 'words' as const, place: { flag: 'quote' } },
            text: words,
            limit: wordsLimit,
          },
        ]),
    ...(args.values.where === undefined
      ? []
      : [
          {
            target: { label: 'where' as const, place: { flag: 'where' } },
            text: args.values.where,
            limit: whereLimit,
          },
        ]),
  ];

  const textRefusal = pickTextRefusal(args, checks, false);

  if (textRefusal !== null) {
    return textRefusal;
  }

  const where = args.values.where ?? '';

  return /[;=]/u.test(where)
    ? { kind: 'extra-has-separator', args, flag: 'where', value: where }
    : null;
}
