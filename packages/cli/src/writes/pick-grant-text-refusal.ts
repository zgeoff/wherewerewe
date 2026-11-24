import { normaliseWords } from '../rules/normalise-words.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { TextCheck } from './pick-text-refusal.ts';

const wordsLimit = 700;
const readingLimit = 200;
const whereLimit = 16;

// The first problem in the grant's texts, in the order pickGrantTextRefusals lists them.
export function pickGrantTextRefusal(args: ParsedArgs): RefusalReason | null {
  return pickGrantTextRefusals(args).at(0) ?? null;
}

// The problems in the grant's texts, one for each flag typed: the words over their limit first, then
// the reading, then the words and --where for their other rules. A command that fixes every flag in
// one Run line needs them all.
export function pickGrantTextRefusals(args: ParsedArgs): RefusalReason[] {
  const words = args.values.quote === undefined ? undefined : normaliseWords(args.values.quote);

  const wordsTooLong: RefusalReason[] =
    words !== undefined && Array.from(words, (character) => character).length > wordsLimit
      ? [
          {
            kind: 'grant-words-too-long',
            args,
            length: Array.from(words, (character) => character).length,
          },
        ]
      : [];

  const readingChecks: TextCheck[] =
    args.values.reading === undefined
      ? []
      : [
          {
            target: { label: 'reading', place: { flag: 'reading' } },
            text: args.values.reading,
            limit: readingLimit,
          },
        ];

  const wordsChecks: TextCheck[] =
    words === undefined
      ? []
      : [{ target: { label: 'words', place: { flag: 'quote' } }, text: words, limit: wordsLimit }];

  const whereChecks: TextCheck[] =
    args.values.where === undefined
      ? []
      : [
          {
            target: { label: 'where', place: { flag: 'where' } },
            text: args.values.where,
            limit: whereLimit,
          },
        ];

  const where = args.values.where ?? '';

  const separator: RefusalReason[] = /[;=]/u.test(where)
    ? [{ kind: 'extra-has-separator', args, flag: 'where', value: where }]
    : [];

  const readingReason = pickTextRefusal(args, readingChecks, false);
  const wordsReason = wordsTooLong.length > 0 ? null : pickTextRefusal(args, wordsChecks, false);
  const whereReason = pickTextRefusal(args, whereChecks, false);

  return [
    ...wordsTooLong,
    ...(readingReason === null ? [] : [readingReason]),
    ...(wordsReason === null ? [] : [wordsReason]),
    ...(whereReason === null ? separator : [whereReason]),
  ];
}
