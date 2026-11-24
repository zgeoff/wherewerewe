import type { GrantWords } from '../rules/count-grant-words.ts';
import { normaliseWords } from '../rules/normalise-words.ts';
import type { ParsedArgs } from '../types.ts';

// The owner's words a command typed, each line break in a bullet or the scope turned into a space.
export function toGrantWords(args: ParsedArgs): GrantWords {
  return {
    may: (args.values.may ?? []).map((bullet) => normaliseWords(bullet)),
    not: (args.values.not ?? []).map((bullet) => normaliseWords(bullet)),
    never: (args.values.never ?? []).map((bullet) => normaliseWords(bullet)),
    scope: args.values.scope === undefined ? null : normaliseWords(args.values.scope),
  };
}
