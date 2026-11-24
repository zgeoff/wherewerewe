import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { wordsCap } from '../rules/item-caps.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason, WordsRow } from '../types.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickBrokenFileRefusal } from './pick-broken-file-refusal.ts';
import { pickDuplicateIDRefusal } from './pick-duplicate-id-refusal.ts';
import { pickKindIDRefusal } from './pick-kind-id-refusal.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// words writes words.tsv and the journal and no other file. An id that holds the owner's words
// replaces them in place. The row's `by` is owner when the command ran from the owner's terminal.
export function pickWordsWrite(input: WriteInput & { readonly byOwner: boolean }): WriteResult {
  const store = input.store;
  const args = input.args;
  const id = args.positionals[0] ?? '';
  const words = args.positionals[1] ?? '';
  const where = args.values.where ?? '';
  const existing = store.words.find((row) => row.id === id);
  const by = input.byOwner ? 'owner' : 'agent';

  const reason =
    pickWordsArgsRefusal(args) ??
    pickDuplicateIDRefusal(input, id) ??
    pickKindIDRefusal(input, id, 'words') ??
    pickBrokenFileRefusal(store, 'words') ??
    pickFullWordsRefusal(input, existing);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(input.nowMs);
  const row: WordsRow = { id, words, where, written: ts, by };

  return {
    kind: 'write',
    change: {
      words:
        existing === undefined
          ? [...store.words, row]
          : store.words.map((candidate) => (candidate.id === id ? row : candidate)),
      journal: [{ ts, op: 'words', id, by, text: words, why: null, extra: `where=${where}` }],
    },
    reply: (figure) =>
      `${id}  owner's words, open, ${String(Array.from(words, (character) => character).length)} of ${String(textLimits.words)}. ${formatBriefLine(figure)}`,
  };
}

// The checks that read the command line and no store: the id, that the words say where, the
// separators the journal keeps apart, then the two texts.
export function pickWordsArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const id = args.positionals[0] ?? '';
  const where = args.values.where;

  if (!isItemID(id)) {
    return { kind: 'bad-id', args, id };
  }

  if (where === undefined) {
    return { kind: 'words-needs-where', args };
  }

  if (/[;=]/u.test(where)) {
    return { kind: 'extra-has-separator', args, flag: 'where', value: where };
  }

  return pickTextRefusal(
    args,
    [
      {
        target: { label: "owner's words", place: { positional: 1 } },
        text: args.positionals[1] ?? '',
        limit: textLimits.words,
      },
      {
        target: { label: 'where', place: { flag: 'where' } },
        text: where,
        limit: textLimits.wordsWhere,
      },
    ],
    false,
  );
}

// The cap, for a new piece of the owner's words only. The refusal offers to drop the oldest.
function pickFullWordsRefusal(
  input: WriteInput,
  existing: WordsRow | undefined,
): RefusalReason | null {
  const [oldest] = input.store.words;

  return existing === undefined && oldest !== undefined && input.store.words.length >= wordsCap
    ? { kind: 'kind-full', itemKind: 'words', oldestID: oldest.id }
    : null;
}
