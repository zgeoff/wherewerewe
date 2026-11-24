import { formatAge } from '../brief/format-age.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import {
  buildChangedNotes,
  buildNoteJournalRows,
  pickNoteChange,
  pickNoteTextRefusal,
  pickNotesUnreadRefusal,
} from './pick-note-change.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

export function pickNowWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const id = args.positionals[0] ?? '';
  const next = args.positionals[1] ?? '';
  const reason = pickNowArgsRefusal(args);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  if (!store.items.some((item) => item.id === id)) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'no-open-item',
        args,
        id,
        openIDs: store.items.map((item) => item.id),
      }),
    };
  }

  const unreadReason = args.values.note === undefined ? null : pickNotesUnreadRefusal(store);

  if (unreadReason !== null) {
    return { kind: 'refused', refusal: buildRefusal(unreadReason) };
  }

  const ts = formatTimestamp(nowMs);
  const noteChange = pickNoteChange(args, id, nowMs);
  const notes = buildChangedNotes(store.notes, id, noteChange);
  const note = (notes ?? store.notes).find((candidate) => candidate.id === id);

  return {
    kind: 'write',
    change: {
      session: { ...store.session, now: id, nowNext: next, nowSet: ts, lastWrite: ts },
      journal: [
        { ts, op: 'now', id, by: 'agent', text: next, why: null, extra: null },
        ...buildNoteJournalRows(id, noteChange, ts),
      ],
      ...(notes === undefined ? {} : { notes }),
    },
    reply: (briefLines) => {
      const brief = `Brief: ${String(briefLines)} lines.`;

      if (note === undefined) {
        return `now: ${id}. ${brief}`;
      }

      const word = note.owed ? 'owed note' : 'note';
      const age = formatAge(nowMs - Date.parse(note.written));

      return [
        ...wrapBlock(note.note, '    ', '    '),
        `now: ${id}, with its ${word} (${age}). ${brief}`,
      ].join('\n');
    },
  };
}

// The checks that read the command line and no store: the next step's text, then the note's.
export function pickNowArgsRefusal(args: ParsedArgs): RefusalReason | null {
  return (
    pickTextRefusal(
      args,
      [
        {
          target: { label: 'next step', place: { positional: 1 } },
          text: args.positionals[1] ?? '',
          limit: textLimits.nextStep,
        },
      ],
      false,
    ) ?? pickNoteTextRefusal(args)
  );
}
