import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import type { Item, ParsedArgs, RefusalReason } from '../types.ts';
import { pickNotesUnreadRefusal } from './pick-note-change.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// An open item whose id the journal already closed lost its rewrite to an interrupted write: it
// finishes the rewrite and adds no second row.
export function pickClose(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const command = getCloseCommand(args);
  const id = args.positionals[0] ?? '';
  const why = pickCloseText(args);

  // the checks refuse a close with no text, so why is set past them
  const argsReason = pickCloseArgsRefusal(args);

  if (argsReason !== null || why === undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal(argsReason ?? { kind: 'needs-evidence', args }),
    };
  }

  const item = store.items.find((candidate) => candidate.id === id);

  if (item === undefined) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'no-open-item',
        args,
        id,
        openIDs: store.items.map((candidate) => candidate.id),
        ...(command === 'use'
          ? {
              suggestIDs: store.items
                .filter(
                  (candidate) => candidate.kind === 'ok' && !input.journal.closed.has(candidate.id),
                )
                .map((candidate) => candidate.id),
            }
          : {}),
      }),
    };
  }

  const useRefusal = command === 'use' ? pickUseRefusal(item) : null;

  if (useRefusal !== null) {
    return { kind: 'refused', refusal: buildRefusal(useRefusal) };
  }

  const unreadReason = pickNotesUnreadRefusal(store);
  const note = store.notes.find((candidate) => candidate.id === id);

  if (unreadReason !== null) {
    return { kind: 'refused', refusal: buildRefusal(unreadReason) };
  }

  if (note?.owed === true) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'owed-note',
        args,
        id,
        age: formatAge(nowMs - Date.parse(note.written)),
        note: note.note,
      }),
    };
  }

  const ts = formatTimestamp(nowMs);
  const wasInFocus = store.session.now === id;
  const isSpent = input.journal.closed.has(id);

  const verb = match(command)
    .with('done', () => 'done')
    .with('drop', () => 'dropped')
    .with('use', () => 'used')
    .exhaustive();

  return {
    kind: 'write',
    change: {
      items: store.items.filter((candidate) => candidate.id !== id),
      ...(note === undefined
        ? {}
        : { notes: store.notes.filter((candidate) => candidate.id !== id) }),
      session: {
        ...store.session,
        lastWrite: ts,
        ...(wasInFocus ? { now: null, nowNext: null, nowSet: null } : {}),
      },
      journal: isSpent
        ? []
        : [{ ts, op: args.command, id, by: 'agent', text: item.claim, why, extra: null }],
    },
    reply: (briefLines) => {
      const brief = `Brief: ${String(briefLines)} lines.`;

      if (note === undefined) {
        return `${id}  ${verb}. Off the brief, kept in the journal. ${brief}`;
      }

      const age = formatAge(nowMs - Date.parse(note.written));

      return [
        `${id}  ${verb}. Off the brief, kept in the journal with its note (${age}). ${brief}`,
        ...wrapBlock(note.note, '    ', '    '),
      ].join('\n');
    },
  };
}

// The checks that read the command line and no store: the text of --evidence, --why or --for, then
// that the command has it.
export function pickCloseArgsRefusal(args: ParsedArgs): RefusalReason | null {
  const command = getCloseCommand(args);
  const why = pickCloseText(args);

  const flag = match(command)
    .with('done', () => 'evidence')
    .with('drop', () => 'why')
    .with('use', () => 'for')
    .exhaustive();

  const label = match(command)
    .with('done', () => 'evidence' as const)
    .with('drop', () => 'reason' as const)
    .with('use', () => '--for text' as const)
    .exhaustive();

  if (why !== undefined) {
    return pickTextRefusal(
      args,
      [{ target: { label, place: { flag } }, text: why, limit: 200 }],
      false,
    );
  }

  return match(command)
    .with('done', (): RefusalReason => ({ kind: 'needs-evidence', args }))
    .with('drop', (): RefusalReason => ({ kind: 'needs-reason', args }))
    .with('use', (): RefusalReason => ({ kind: 'use-needs-for', args }))
    .exhaustive();
}

function getCloseCommand(args: ParsedArgs): 'done' | 'drop' | 'use' {
  return args.command === 'done' || args.command === 'use' ? args.command : 'drop';
}

function pickCloseText(args: ParsedArgs): string | undefined {
  return match(getCloseCommand(args))
    .with('done', () => args.values.evidence)
    .with('drop', () => args.values.why)
    .with('use', () => args.values.for)
    .exhaustive();
}

function pickUseRefusal(item: Item): RefusalReason | null {
  return item.kind === 'ok' ? null : { kind: 'use-not-approval', id: item.id, itemKind: item.kind };
}
