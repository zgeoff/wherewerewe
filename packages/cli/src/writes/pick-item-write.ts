import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatCommandLine } from '../refusals/format-command-line.ts';
import { canBlock } from '../rules/can-block.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { parseCheckFlags } from '../rules/parse-check-flags.ts';
import type { CheckFlagsResult } from '../rules/parse-check-flags.ts';
import type { Extra, Item, Kind, Note, ParsedArgs, RefusalReason } from '../types.ts';
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
  const checks = parseCheckFlags(args.flags, input.cwd);

  const reason =
    pickIDRefusal(args, id, isSet) ??
    pickSetWithoutClaimRefusal(args, hasClaim) ??
    pickApprovalRefusal(args) ??
    (hasClaim ? pickClaimRefusal(args, claim, existing) : null) ??
    pickNoteTextRefusal(args) ??
    pickCheckRefusal(args, checks, existing) ??
    pickWhoRefusal(args, existing) ??
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
      reply: (briefLines) => {
        const brief = `Brief: ${String(briefLines)} lines.`;

        return noteChange.kind === 'write'
          ? `${id}  note, ${formatNotePart(noteChange.note)}. ${brief}`
          : `${id}  note cleared. ${brief}`;
      },
    };
  }

  const kind = isSet ? (existing?.kind ?? 'task') : getKind(args.command);
  const ref = pickCheckRef(checks);

  const item: Item = {
    id,
    kind,
    claim,
    check: isSet ? (ref ?? existing?.check ?? null) : ref,
    atWrite: null,
    last: null,
    written: ts,
    by: 'agent',
    extra: isSet ? (existing?.extra ?? {}) : buildExtra(args),
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
    reply: (briefLines) => {
      const brief = `Brief: ${String(briefLines)} lines.`;

      const check = match(kind)
        .with('rule', () => '')
        .with(
          'task',
          'wait',
          'where',
          'ok',
          () => `, ${item.check === null ? 'no check' : 'no check run'}`,
        )
        .exhaustive();

      const note = noteChange.kind === 'write' ? `, ${formatNotePart(noteChange.note)}` : '';
      const first = `${id}  ${kind}, open${check}${note}. ${brief}`;

      return existing !== undefined && existingNote !== undefined && noteChange.kind === 'keep'
        ? `${first}\n${formatOlderNoteLine(args, id, existingNote, nowMs)}`
        : first;
    },
  };
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

  return hasNoteFlag(args) ? null : { kind: 'set-needs-change', args };
}

type ApprovalFlag = 'quote' | 'who' | 'where' | 'scope';

interface ApprovalText {
  readonly flag: ApprovalFlag;
  readonly limit: number;
}

const approvalFlags: readonly ApprovalText[] = [
  { flag: 'quote', limit: 120 },
  { flag: 'who', limit: 16 },
  { flag: 'where', limit: 16 },
  { flag: 'scope', limit: 40 },
];

function pickApprovalRefusal(args: ParsedArgs): RefusalReason | null {
  if (args.command !== 'ok') {
    return null;
  }

  const missing = approvalFlags.filter((text) => args.values[text.flag] === undefined);
  const needsUse = (args.values.once === true) === (args.values.standing === true);

  if (missing.length > 0 || needsUse) {
    return { kind: 'ok-needs-parts', args, missing: missing.map((text) => text.flag), needsUse };
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
        [{ target: { label: 'claim', place: { positional: 1 } }, text: claim, limit: 120 }],
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
    [{ target: { label: 'who', place: { flag: 'who' } }, text: who, limit: 16 }],
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
  const existing = store.items.find((item) => item.id === id);

  if (isSet) {
    return existing === undefined
      ? { kind: 'no-open-item', args, id, openIDs: store.items.map((item) => item.id) }
      : null;
  }

  const closedTs = input.journal.closed.get(id);

  if (existing === undefined && closedTs !== undefined) {
    return {
      kind: 'closed-id',
      args,
      id,
      day: getSessionDay(store.session.started, Date.parse(closedTs)),
    };
  }

  if (existing !== undefined && existing.kind !== getKind(args.command)) {
    return { kind: 'other-kind', args, id, itemKind: existing.kind };
  }

  return null;
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

  return pickFullKind(input.store.items, kind);
}

const caps: Readonly<Record<Kind, number>> = { task: 6, wait: 4, rule: 5, where: 4, ok: 3 };

function pickFullKind(items: readonly Item[], kind: Kind): RefusalReason | null {
  const ofKind = items.filter((item) => item.kind === kind);
  const [oldest] = ofKind;

  return oldest !== undefined && ofKind.length >= caps[kind]
    ? { kind: 'kind-full', itemKind: kind, oldestID: oldest.id }
    : null;
}

// `<k> of 400`, then `, owed` for an owed note.
function formatNotePart(note: Note): string {
  return `${String([...note.note].length)} of 400${note.owed ? ', owed' : ''}`;
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
      use: args.values.once === true ? 'once' : 'standing',
    };
  }

  return {};
}

function buildJournalExtra(item: Item): string | null {
  const parts = [
    ...(item.kind === 'ok' && item.extra.use !== undefined ? [`use=${item.extra.use}`] : []),
    ...(item.check === null ? [] : [`check=${item.check}`]),
  ];

  return parts.length === 0 ? null : parts.join(';');
}

function formatOlderNoteLine(args: ParsedArgs, id: string, note: Note, nowMs: number): string {
  const scope = buildRefusalScope(args);
  const session = args.sessionFlag === null ? [] : ['--session', args.sessionFlag];

  const replace = formatCommandLine(
    [...session, 'set', id, '--note', '<detail>'],
    scope.typedWords,
  );

  const clear = formatCommandLine([...session, 'set', id, '--no-note'], scope.typedWords);
  const age = formatAge(nowMs - Date.parse(note.written));

  return `  its note is ${age} older than this claim. Replace it with ${replace}, or clear it with ${clear}`;
}
