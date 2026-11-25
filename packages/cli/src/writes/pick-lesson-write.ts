import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { lessonCap } from '../rules/item-caps.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { LessonRow, ParsedArgs, RefusalReason } from '../types.ts';
import { findOldestRow } from './find-oldest-row.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickBrokenFileRefusal } from './pick-broken-file-refusal.ts';
import { pickDuplicateIDRefusal } from './pick-duplicate-id-refusal.ts';
import { pickKindIDRefusal } from './pick-kind-id-refusal.ts';
import { pickCredentialRefusal, pickTextRefusal } from './pick-text-refusal.ts';
import type { TextCheck } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// lesson writes lessons.tsv and the journal and no other file. An id that holds a lesson replaces
// it in place.
export function pickLessonWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const id = args.positionals[0] ?? '';
  const text = args.positionals[1] ?? '';
  const why = args.values.why ?? '';
  const existing = store.lessons.find((row) => row.id === id);

  const reason =
    pickLessonArgsRefusal(args) ??
    pickDuplicateIDRefusal(input, id) ??
    pickKindIDRefusal(input, id, 'lesson') ??
    pickBrokenFileRefusal(store, 'lesson') ??
    pickFullLessonsRefusal(input, existing);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(input.nowMs);
  const row: LessonRow = { id, text, why, written: ts, by: 'agent' };

  return {
    kind: 'write',
    change: {
      lessons:
        existing === undefined
          ? [...store.lessons, row]
          : store.lessons.map((candidate) => (candidate.id === id ? row : candidate)),
      journal: [{ ts, op: 'lesson', id, by: 'agent', text, why, extra: null }],
    },
    reply: (figure) =>
      `${id}  lesson, open, why ${String(Array.from(why, (character) => character).length)} of ${String(textLimits.lessonWhy)}. ${formatBriefLine(figure)}`,
  };
}

// The checks that read the command line and no store: the id, a credential in either text, that
// the lesson has its why, then the two texts.
export function pickLessonArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const id = args.positionals[0] ?? '';
  const why = args.values.why;
  const checks = buildLessonChecks(args);

  if (!isItemID(id)) {
    return { kind: 'bad-id', args, id };
  }

  const credential = pickCredentialRefusal(args, checks, false);

  if (credential !== null) {
    return credential;
  }

  if (why === undefined) {
    return { kind: 'lesson-needs-why', args };
  }

  return pickTextRefusal(args, checks, false);
}

function buildLessonChecks(args: ParsedArgs): TextCheck[] {
  return [
    {
      target: { label: 'lesson', place: { positional: 1 } },
      text: args.positionals[1] ?? '',
      limit: textLimits.lesson,
    },
    {
      target: { label: 'why', place: { flag: 'why' } },
      text: args.values.why ?? '',
      limit: textLimits.lessonWhy,
    },
  ];
}

// The cap, for a new lesson only. The refusal offers to drop the oldest.
function pickFullLessonsRefusal(
  input: WriteInput,
  existing: LessonRow | undefined,
): RefusalReason | null {
  const oldest = findOldestRow(input.store.lessons);

  return existing === undefined && oldest !== undefined && input.store.lessons.length >= lessonCap
    ? { kind: 'kind-full', itemKind: 'lesson', oldestID: oldest.id }
    : null;
}
