import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { normaliseWords } from '../rules/normalise-words.ts';
import type { Grant, RefusalReason } from '../types.ts';
import { pickGrantPartsRefusal } from './pick-grant-parts-refusal.ts';
import { pickGrantTextRefusal } from './pick-grant-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// www grant --quote <words> --where <where> --reading <reading>, or www grant --reading <reading>.
// Line breaks in the words become one space each before any check. `byOwner` is the terminal test
// of owner-notes.md, read by the caller.
export function pickGrantWrite(input: WriteInput & { readonly byOwner: boolean }): WriteResult {
  const args = input.args;
  const session = input.store.session;

  const reason =
    pickGrantNeedsPartRefusal(input) ??
    pickReadingNoGrantRefusal(input) ??
    pickGrantTextRefusal(args);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const quote = args.values.quote;
  const ts = formatTimestamp(input.nowMs);
  const by = input.byOwner ? 'owner' : 'agent';

  const grant: Grant =
    quote === undefined
      ? {
          ...(session.grant ?? { words: '', where: '', set: ts }),
          reading: args.values.reading ?? '',
        }
      : {
          words: normaliseWords(quote),
          reading: args.values.reading ?? '',
          where: args.values.where ?? '',
          set: ts,
        };

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
          text: grant.words,
          why: grant.reading,
          extra: quote === undefined ? `where=${grant.where};reading=1` : `where=${grant.where}`,
        },
      ],
    },
    reply: (briefLines) =>
      quote === undefined
        ? `grant reading: ${String(Array.from(grant.reading, (character) => character).length)} of 200. Brief: ${String(briefLines)} lines.`
        : `grant: ${String(Array.from(grant.words, (character) => character).length)} of 700 characters, reading ${String(Array.from(grant.reading, (character) => character).length)} of 200. Brief: ${String(briefLines)} lines.`,
  };
}

// No flag at all, or --quote or --where without all three.
function pickGrantNeedsPartRefusal(input: WriteInput): RefusalReason | null {
  const values = input.args.values;

  return values.quote === undefined && values.where === undefined && values.reading === undefined
    ? { kind: 'grant-needs-part', args: input.args }
    : pickGrantPartsRefusal(input.args, true);
}

function pickReadingNoGrantRefusal(input: WriteInput): RefusalReason | null {
  const quote = input.args.values.quote;

  return quote === undefined && input.store.session.grant === null
    ? { kind: 'grant-reading-no-grant', args: input.args, name: input.store.session.name }
    : null;
}
