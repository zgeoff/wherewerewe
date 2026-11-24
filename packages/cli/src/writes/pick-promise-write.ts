import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { promiseCap } from '../rules/item-caps.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, PromiseRow, RefusalReason } from '../types.ts';
import { findOldestRow } from './find-oldest-row.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickBrokenFileRefusal } from './pick-broken-file-refusal.ts';
import { pickDuplicateIDRefusal } from './pick-duplicate-id-refusal.ts';
import { pickKindIDRefusal } from './pick-kind-id-refusal.ts';
import { pickCredentialRefusal, pickTextRefusal } from './pick-text-refusal.ts';
import type { TextCheck } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// promise writes promises.tsv and the journal and no other file. An id that holds a promise
// replaces it in place.
export function pickPromiseWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const id = args.positionals[0] ?? '';
  const what = args.positionals[1] ?? '';
  const to = args.values.to ?? '';
  const byWhen = args.values.by ?? '';
  const existing = store.promises.find((row) => row.id === id);

  const reason =
    pickPromiseArgsRefusal(args) ??
    pickDuplicateIDRefusal(input, id) ??
    pickKindIDRefusal(input, id, 'promise') ??
    pickBrokenFileRefusal(store, 'promise') ??
    pickFullPromisesRefusal(input, existing);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(input.nowMs);
  const row: PromiseRow = { id, what, to, byWhen, written: ts, by: 'agent' };

  return {
    kind: 'write',
    change: {
      promises:
        existing === undefined
          ? [...store.promises, row]
          : store.promises.map((candidate) => (candidate.id === id ? row : candidate)),
      journal: [
        {
          ts,
          op: 'promise',
          id,
          by: 'agent',
          text: what,
          why: null,
          extra: `to=${to};by=${byWhen}`,
        },
      ],
    },
    reply: (figure) => `${id}  promise to ${to}, by ${byWhen}. ${formatBriefLine(figure)}`,
  };
}

// The checks that read the command line and no store: the id, a credential in any text, that the
// promise names who and when, the separators the journal keeps apart, then the three texts.
export function pickPromiseArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const id = args.positionals[0] ?? '';
  const to = args.values.to;
  const by = args.values.by;
  const checks = buildPromiseChecks(args);

  if (!isItemID(id)) {
    return { kind: 'bad-id', args, id };
  }

  const credential = pickCredentialRefusal(args, checks, false);

  if (credential !== null) {
    return credential;
  }

  const missing = [
    ...(to === undefined ? (['to'] as const) : []),
    ...(by === undefined ? (['by'] as const) : []),
  ];

  if (missing.length > 0) {
    return { kind: 'promise-needs-parts', args, missing };
  }

  for (const flag of ['to', 'by'] as const) {
    const value = args.values[flag] ?? '';

    if (/[;=]/u.test(value)) {
      return { kind: 'promise-separator', args, flag, value };
    }
  }

  return pickTextRefusal(args, checks, false);
}

function buildPromiseChecks(args: ParsedArgs): TextCheck[] {
  return [
    {
      target: { label: 'promise', place: { positional: 1 } },
      text: args.positionals[1] ?? '',
      limit: textLimits.promise,
    },
    {
      target: { label: '--to', place: { flag: 'to' } },
      text: args.values.to ?? '',
      limit: textLimits.promiseTo,
    },
    {
      target: { label: '--by', place: { flag: 'by' } },
      text: args.values.by ?? '',
      limit: textLimits.promiseBy,
    },
  ];
}

// The cap, for a new promise only. The refusal offers to close the oldest.
function pickFullPromisesRefusal(
  input: WriteInput,
  existing: PromiseRow | undefined,
): RefusalReason | null {
  const oldest = findOldestRow(input.store.promises);

  return existing === undefined && oldest !== undefined && input.store.promises.length >= promiseCap
    ? { kind: 'kind-full', itemKind: 'promise', oldestID: oldest.id }
    : null;
}
