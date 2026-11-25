import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { Item, ParsedArgs, RefusalReason } from '../types.ts';
import { collectOpenIDs } from './collect-id-holders.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { isOwnCloseRetry } from './is-own-close-retry.ts';
import { pickDuplicateIDRefusal } from './pick-duplicate-id-refusal.ts';
import { pickFileClose } from './pick-file-close.ts';
import { pickNotesUnreadRefusal } from './pick-note-change.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// An open item whose own close is the newest journal row of its id lost its rewrite to an
// interrupted write: it finishes the rewrite and adds no second row (isOwnCloseRetry).
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

  const duplicate = pickDuplicateIDRefusal(input, id);

  if (duplicate !== null) {
    return { kind: 'refused', refusal: buildRefusal(duplicate) };
  }

  const item = store.items.find((candidate) => candidate.id === id);

  if (item === undefined) {
    const fileClose = pickFileClose(input, command, id, why);

    if (fileClose !== null) {
      return fileClose;
    }

    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'no-open-item',
        args,
        id,
        openIDs: collectOpenIDs(store),
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
  const isSpent = isOwnCloseRetry(input.journal.lastRows.items.get(id), command, item.claim);

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
    reply: (figure) => {
      const brief = formatBriefLine(figure);

      if (note === undefined) {
        return `${id}  ${verb}. Off the brief, kept in the journal. ${brief}`;
      }

      const age = formatAge(nowMs - Date.parse(note.written));

      return [
        ...wrapBlock(note.note, '    ', '    '),
        `${id}  ${verb}. Off the brief, kept in the journal with its note (${age}). ${brief}`,
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
      [{ target: { label, place: { flag } }, text: why, limit: textLimits.closeText }],
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
