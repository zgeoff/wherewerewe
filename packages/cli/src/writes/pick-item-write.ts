import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatCommandLine } from '../refusals/format-command-line.ts';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { canBlock } from '../rules/can-block.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { itemCaps } from '../rules/item-caps.ts';
import { parseCheckFlags } from '../rules/parse-check-flags.ts';
import type { CheckFlagsResult } from '../rules/parse-check-flags.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { Extra, Item, Kind, Note, ParsedArgs, RefusalReason, Store } from '../types.ts';
import { collectIDHolders, collectOpenIDs } from './collect-id-holders.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { formatChainLine } from './format-chain-line.ts';
import { pickDuplicateIDRefusal } from './pick-duplicate-id-refusal.ts';
import { pickKindIDRefusal } from './pick-kind-id-refusal.ts';
import {
  buildChangedNotes,
  buildNoteJournalRows,
  hasNoteFlag,
  pickNoClearRefusal,
  pickNoteChange,
  pickNoteTextRefusal,
  pickNotesUnreadRefusal,
} from './pick-note-change.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// task, wait, rule, where and ok write a new item, or replace an open item of the same kind. set
// replaces the claim of an open item and keeps its kind. A set with no claim changes only the note.
export function pickItemWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const id = args.positionals[0] ?? '';
  const isApproval = args.command === 'ok';
  const claim = isApproval ? (args.values.quote ?? '') : (args.positionals[1] ?? '');
  const isSet = args.command === 'set';
  const hasClaim = !isSet || args.positionals.length === 2;
  const existing = store.items.find((item) => item.id === id);
  const existingNote = store.notes.find((note) => note.id === id);

  const reason =
    pickItemArgsRefusal(args, input.cwd, existing) ??
    pickStoreRefusal(input, id, isSet) ??
    (hasNoteFlag(args) ? pickNotesUnreadRefusal(store) : null) ??
    pickNoClearRefusal(args, id, existingNote) ??
    pickBlockedByRefusal(input) ??
    pickCapRefusal(input, id, isSet);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const ts = formatTimestamp(nowMs);
  const noteChange = pickNoteChange(args, id, nowMs);
  const notes = buildChangedNotes(store.notes, id, noteChange);
  const noteRows = buildNoteJournalRows(id, noteChange, ts);
  const session = { ...store.session, lastWrite: ts };

  if (!hasClaim) {
    return {
      kind: 'write',
      change: { session, journal: noteRows, ...(notes === undefined ? {} : { notes }) },
      reply: (figure) => {
        const brief = formatBriefLine(figure);

        const chain = formatChainLine(id, {
          claim: null,
          note: noteChange.kind === 'write' ? noteChange.note.note : null,
        });

        const status =
          noteChange.kind === 'write'
            ? `${id}  note, ${formatNotePart(noteChange.note)}. ${brief}`
            : `${id}  note cleared. ${brief}`;

        return chain === null ? status : `${chain}\n${status}`;
      },
    };
  }

  const kind = isSet ? (existing?.kind ?? 'task') : getKind(args.command);
  const checkRef = pickWriteCheck(args, store, input.cwd);
  const probed = input.probed !== null && input.probed.ref === checkRef ? input.probed : null;
  const baseExtra = isSet ? (existing?.extra ?? {}) : buildExtra(args);
  const { pid_start: _oldStart, ...keptExtra } = baseExtra;

  const item: Item = {
    id,
    kind,
    claim,
    check: checkRef,
    atWrite: probed === null || probed.result === 'unchecked' ? null : probed.result,
    last: null,
    written: ts,
    by: 'agent',
    extra:
      probed === null || probed.pidStart === null
        ? keptExtra
        : { ...keptExtra, pid_start: probed.pidStart },
  };

  const items =
    existing === undefined
      ? [...store.items, item]
      : store.items.map((candidate) => (candidate.id === id ? item : candidate));

  return {
    kind: 'write',
    change: {
      items,
      session,
      journal: [
        {
          ts,
          op: args.command,
          id,
          by: 'agent',
          text: claim,
          why: null,
          extra: buildJournalExtra(item),
        },
        ...noteRows,
      ],
      ...(notes === undefined ? {} : { notes }),
    },
    reply: (figure) => {
      const brief = formatBriefLine(figure);

      const check = match(kind)
        .with('rule', () => '')
        .with(
          'task',
          'wait',
          'where',
          'ok',
          () =>
            `, ${item.check === null ? 'no check' : `checked now: ${probed?.result ?? 'unchecked'}`}`,
        )
        .exhaustive();

      const note = noteChange.kind === 'write' ? `, note ${formatNotePart(noteChange.note)}` : '';
      const status = `${id}  ${kind}, open${check}${note}. ${brief}`;

      const chain = formatChainLine(id, {
        claim,
        note: noteChange.kind === 'write' ? noteChange.note.note : null,
      });

      const lines = [
        ...(existing !== undefined && existingNote !== undefined && noteChange.kind === 'keep'
          ? [formatOlderNoteLine(args, id, existingNote, nowMs)]
          : []),
        ...(chain === null ? [] : [chain]),
        status,
      ];

      return lines.join('\n');
    },
  };
}

// The check a write will store, which the write probes before it takes the lock: the check flag,
// or for a set with a claim and no check flag, the item's own. Null for a write with no claim or
// no check.
export function pickWriteCheck(args: ParsedArgs, store: Store, cwd: string): string | null {
  const isSet = args.command === 'set';

  if (!writeCheckCommands.has(args.command) || (isSet && args.positionals.length !== 2)) {
    return null;
  }

  const ref = pickCheckRef(parseCheckFlags(args.flags, cwd));

  return isSet
    ? (ref ?? store.items.find((item) => item.id === args.positionals[0])?.check ?? null)
    : ref;
}

const writeCheckCommands: ReadonlySet<string> = new Set(['task', 'wait', 'where', 'ok', 'set']);

// The checks that read the command line and no store, in the order the write runs them. The
// existing item only sets the credential refusal's wording and whether a set gives a rule a check.
export function pickItemArgsRefusal(
  args: ParsedArgs,
  cwd: string,
  existing: Item | undefined,
): RefusalReason | null {
  const id = args.positionals[0] ?? '';
  const isApproval = args.command === 'ok';
  const claim = isApproval ? (args.values.quote ?? '') : (args.positionals[1] ?? '');
  const isSet = args.command === 'set';
  const hasClaim = !isSet || args.positionals.length === 2;

  return (
    pickIDRefusal(args, id, isSet) ??
    pickSetWithoutClaimRefusal(args, hasClaim) ??
    pickApprovalRefusal(args) ??
    (hasClaim ? pickClaimRefusal(args, claim, existing) : null) ??
    pickNoteTextRefusal(args) ??
    pickCheckRefusal(args, parseCheckFlags(args.flags, cwd), existing) ??
    pickWhoRefusal(args, existing)
  );
}

function pickIDRefusal(args: ParsedArgs, id: string, isSet: boolean): RefusalReason | null {
  return isSet || isItemID(id) ? null : { kind: 'bad-id', args, id };
}

const checkFlagNames: ReadonlySet<string> = new Set(['pr', 'branch', 'path', 'pid']);

// set with one positional changes only the note, so it needs --note or --no-note, and a check
// belongs to a claim.
function pickSetWithoutClaimRefusal(args: ParsedArgs, hasClaim: boolean): RefusalReason | null {
  if (hasClaim) {
    return null;
  }

  if (args.flags.some((flag) => checkFlagNames.has(flag.name))) {
    return { kind: 'set-check-needs-claim', args };
  }

  // --owed alone gets its own refusal, which names the note it needs
  return hasNoteFlag(args) || args.values.owed === true ? null : { kind: 'set-needs-change', args };
}

type ApprovalFlag = 'quote' | 'who' | 'where' | 'scope';

interface ApprovalText {
  readonly flag: ApprovalFlag;
  readonly limit: number;
}

const approvalFlags: readonly ApprovalText[] = [
  { flag: 'quote', limit: textLimits.quote },
  { flag: 'who', limit: textLimits.approvalWho },
  { flag: 'where', limit: textLimits.approvalWhere },
  { flag: 'scope', limit: textLimits.approvalScope },
];

function pickApprovalRefusal(args: ParsedArgs): RefusalReason | null {
  if (args.command !== 'ok') {
    return null;
  }

  if (args.values.standing === true) {
    return { kind: 'ok-standing', args };
  }

  const missing = approvalFlags.filter((text) => args.values[text.flag] === undefined);

  if (missing.length > 0) {
    return { kind: 'ok-needs-parts', args, missing: missing.map((text) => text.flag) };
  }

  const textReason = pickTextRefusal(
    args,
    approvalFlags.map((text) => ({
      target: { label: text.flag, place: { flag: text.flag } },
      text: args.values[text.flag] ?? '',
      limit: text.limit,
    })),
    false,
  );

  if (textReason !== null) {
    return textReason;
  }

  return pickSeparatorRefusal(args);
}

function pickSeparatorRefusal(args: ParsedArgs): RefusalReason | null {
  for (const flag of ['who', 'where', 'scope'] as const) {
    const value = args.values[flag] ?? '';

    if (/[;=]/u.test(value)) {
      return { kind: 'extra-has-separator', args, flag, value };
    }
  }

  return null;
}

function pickClaimRefusal(
  args: ParsedArgs,
  claim: string,
  existing: Item | undefined,
): RefusalReason | null {
  return args.command === 'ok'
    ? null
    : pickTextRefusal(
        args,
        [
          {
            target: { label: 'claim', place: { positional: 1 } },
            text: claim,
            limit: textLimits.claim,
          },
        ],
        existing !== undefined && existing.kind !== 'where',
      );
}

function pickCheckRefusal(
  args: ParsedArgs,
  checks: CheckFlagsResult,
  existing: Item | undefined,
): RefusalReason | null {
  const isRule = args.command === 'rule' || (args.command === 'set' && existing?.kind === 'rule');

  return match(checks)
    .with({ kind: 'too-many' }, (found): RefusalReason => ({
      kind: 'too-many-checks',
      args,
      firstFlag: found.first.flag,
    }))
    .with({ kind: 'malformed' }, (found): RefusalReason => ({
      kind: 'malformed-check',
      args,
      flag: found.flag,
    }))
    .with({ kind: 'not-one-line' }, (found): RefusalReason => ({
      kind: 'check-not-one-line',
      args,
      flag: found.flag,
    }))
    .with({ kind: 'relative' }, (found): RefusalReason => ({
      kind: 'relative-path',
      args,
      flag: found.flag,
      absolute: found.absolute,
    }))
    .with({ kind: 'check' }, (): RefusalReason | null =>
      isRule ? { kind: 'rule-has-check', args } : null,
    )
    .with({ kind: 'none' }, () => null)
    .exhaustive();
}

function pickWhoRefusal(args: ParsedArgs, existing: Item | undefined): RefusalReason | null {
  if (args.command !== 'wait') {
    return null;
  }

  const who = args.values.who;

  if (who === undefined) {
    return { kind: 'needs-who', args };
  }

  const reason = pickTextRefusal(
    args,
    [{ target: { label: 'who', place: { flag: 'who' } }, text: who, limit: textLimits.waitWho }],
    existing !== undefined && existing.kind !== 'where',
  );

  if (reason !== null) {
    return reason;
  }

  return /[;=]/u.test(who) ? { kind: 'extra-has-separator', args, flag: 'who', value: who } : null;
}

function pickStoreRefusal(input: WriteInput, id: string, isSet: boolean): RefusalReason | null {
  const store = input.store;
  const args = input.args;
  const duplicate = pickDuplicateIDRefusal(input, id);

  if (duplicate !== null) {
    return duplicate;
  }

  if (isSet) {
    return store.items.some((item) => item.id === id) ? null : pickNoOpenItemRefusal(input, id);
  }

  return pickKindIDRefusal(input, id, getKind(args.command));
}

// The refusal for an id that no item holds: the other-kind refusal when a lesson, a promise or the
// owner's words holds it, else no open item, listing the ids of all four files.
export function pickNoOpenItemRefusal(input: WriteInput, id: string): RefusalReason {
  const [holder] = collectIDHolders(input.store, id);

  return holder === undefined
    ? { kind: 'no-open-item', args: input.args, id, openIDs: collectOpenIDs(input.store) }
    : { kind: 'other-kind', args: input.args, id, itemKind: holder.kind };
}

function getKind(command: string): Item['kind'] {
  if (command === 'wait' || command === 'rule' || command === 'where' || command === 'ok') {
    return command;
  }

  return 'task';
}

function pickBlockedByRefusal(input: WriteInput): RefusalReason | null {
  const store = input.store;
  const args = input.args;
  const blockedBy = args.values['blocked-by'];

  if (args.command !== 'task' || blockedBy === undefined) {
    return null;
  }

  const openIDs = store.items.filter((item) => canBlock(item.kind)).map((item) => item.id);

  const holder = collectIDHolders(store, blockedBy).find(
    (candidate) => candidate.file !== 'items.tsv',
  );

  if (holder !== undefined) {
    return { kind: 'other-kind', args, id: blockedBy, itemKind: holder.kind };
  }

  return openIDs.includes(blockedBy)
    ? null
    : { kind: 'blocked-by-unknown', args, blockedBy, openIDs };
}

// The kind's cap, for a new item only.
function pickCapRefusal(input: WriteInput, id: string, isSet: boolean): RefusalReason | null {
  const kind = getKind(input.args.command);

  if (isSet || input.store.items.some((item) => item.id === id)) {
    return null;
  }

  return pickFullKind(input.store.items, input.store.notes, kind);
}

// The refusal offers to close the oldest item that owes no note, because `done` refuses an owed
// note; when every item owes one, the oldest, whose `done` refusal names the way to clear it.
function pickFullKind(
  items: readonly Item[],
  notes: readonly Note[],
  kind: Kind,
): RefusalReason | null {
  const ofKind = items.filter((item) => item.kind === kind);

  const owedIDs = new Set(notes.filter((note) => note.owed).map((note) => note.id));

  const oldest = ofKind.find((item) => !owedIDs.has(item.id)) ?? ofKind[0];

  return oldest !== undefined && ofKind.length >= itemCaps[kind]
    ? { kind: 'kind-full', itemKind: kind, oldestID: oldest.id }
    : null;
}

// `<k> of <note limit>`, then `, owed` for an owed note.
function formatNotePart(note: Note): string {
  return `${String(Array.from(note.note, (character) => character).length)} of ${String(textLimits.note)}${note.owed ? ', owed' : ''}`;
}

function pickCheckRef(checks: CheckFlagsResult): string | null {
  return match(checks)
    .with({ kind: 'check' }, (found) => found.ref)
    .with(
      { kind: 'none' },
      { kind: 'too-many' },
      { kind: 'malformed' },
      { kind: 'not-one-line' },
      { kind: 'relative' },
      () => null,
    )
    .exhaustive();
}

function buildExtra(args: ParsedArgs): Extra {
  if (args.command === 'wait' && args.values.who !== undefined) {
    return { who: args.values.who };
  }

  if (args.command === 'task' && args.values['blocked-by'] !== undefined) {
    return { blocked_by: args.values['blocked-by'] };
  }

  if (args.command === 'ok') {
    return {
      who: args.values.who ?? '',
      where: args.values.where ?? '',
      scope: args.values.scope ?? '',
    };
  }

  return {};
}

function buildJournalExtra(item: Item): string | null {
  return item.check === null ? null : `check=${item.check}`;
}

function formatOlderNoteLine(args: ParsedArgs, id: string, note: Note, nowMs: number): string {
  const session = args.sessionFlag === null ? [] : ['--session', args.sessionFlag];
  const replace = formatCommandLine([...session, 'set', id, '--note', toPlaceholder('<detail>')]);
  const clear = formatCommandLine([...session, 'set', id, '--no-note']);
  const age = formatAge(nowMs - Date.parse(note.written));

  return `  its note is ${age} older than this claim. Replace it with ${replace}, or clear it with ${clear}`;
}
