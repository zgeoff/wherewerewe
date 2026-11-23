import { getSessionDay } from '../brief/get-session-day.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { parseCheckFlags } from '../rules/parse-check-flags.ts';
import type { CheckFlagsResult } from '../rules/parse-check-flags.ts';
import type { Extra, Item, ParsedArgs, RefusalReason } from '../types.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// task, wait, rule and where write a new item, or replace an open item of the same kind. set
// replaces the claim of an open item and keeps its kind.
export function pickItemWrite(input: WriteInput): WriteResult {
  const store = input.store;
  const args = input.args;
  const nowMs = input.nowMs;
  const id = args.positionals[0] ?? '';
  const claim = args.positionals[1] ?? '';
  const isSet = args.command === 'set';
  const existing = store.items.find((item) => item.id === id);
  const checks = parseCheckFlags(args.flags, input.cwd);

  const reason =
    pickIDRefusal(args, id, isSet) ??
    pickTextRefusal(
      args,
      [{ target: { label: 'claim', place: { positional: 1 } }, text: claim, limit: 120 }],
      existing !== undefined && existing.kind !== 'where',
    ) ??
    pickCheckRefusal(args, checks, existing) ??
    pickWhoRefusal(args, existing) ??
    pickStoreRefusal(input, id, isSet) ??
    pickBlockedByRefusal(input) ??
    pickCapRefusal(input, id, isSet);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  const kind = isSet ? (existing?.kind ?? 'task') : getKind(args.command);
  const ts = formatTimestamp(nowMs);
  const ref = checks.kind === 'check' ? checks.ref : null;

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
      session: { ...store.session, lastWrite: ts },
      journal: [
        {
          ts,
          op: args.command,
          id,
          by: 'agent',
          text: claim,
          why: null,
          extra: item.check === null ? null : `check=${item.check}`,
        },
      ],
    },
    reply: (briefLines) => {
      const brief = `Brief: ${String(briefLines)} lines.`;

      if (kind === 'rule') {
        return `${id}  rule, open. ${brief}`;
      }

      return `${id}  ${kind}, open, ${item.check === null ? 'no check' : 'no check run'}. ${brief}`;
    },
  };
}

function pickIDRefusal(args: ParsedArgs, id: string, isSet: boolean): RefusalReason | null {
  return isSet || isItemID(id) ? null : { kind: 'bad-id', args, id };
}

function pickCheckRefusal(
  args: ParsedArgs,
  checks: CheckFlagsResult,
  existing: Item | undefined,
): RefusalReason | null {
  if (checks.kind === 'too-many') {
    return { kind: 'too-many-checks', args, firstFlag: checks.first.flag };
  }

  if (checks.kind === 'malformed') {
    return { kind: 'malformed-check', args, flag: checks.flag };
  }

  if (checks.kind === 'relative') {
    return { kind: 'relative-path', args, flag: checks.flag, absolute: checks.absolute };
  }

  const isRule = args.command === 'rule' || (args.command === 'set' && existing?.kind === 'rule');

  return isRule && checks.kind === 'check' ? { kind: 'rule-has-check', args } : null;
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

  return /[;=]/u.test(who) ? { kind: 'who-has-separator', args, who } : null;
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
  if (command === 'wait' || command === 'rule' || command === 'where') {
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

  const openIDs = store.items
    .filter((item) => item.kind === 'task' || item.kind === 'wait')
    .map((item) => item.id);

  return openIDs.includes(blockedBy)
    ? null
    : { kind: 'blocked-by-unknown', args, blockedBy, openIDs };
}

type CappedKind = 'task' | 'wait' | 'rule' | 'where';

const caps: Readonly<Record<CappedKind, number>> = { task: 6, wait: 4, rule: 5, where: 4 };

// The kind's cap, for a new item only.
function pickCapRefusal(input: WriteInput, id: string, isSet: boolean): RefusalReason | null {
  const kind = getKind(input.args.command);

  if (isSet || kind === 'ok' || input.store.items.some((item) => item.id === id)) {
    return null;
  }

  const ofKind = input.store.items.filter((item) => item.kind === kind);
  const [oldest] = ofKind;

  return oldest !== undefined && ofKind.length >= caps[kind]
    ? { kind: 'kind-full', itemKind: kind, oldestID: oldest.id }
    : null;
}

function buildExtra(args: ParsedArgs): Extra {
  if (args.command === 'wait' && args.values.who !== undefined) {
    return { who: args.values.who };
  }

  if (args.command === 'task' && args.values['blocked-by'] !== undefined) {
    return { blocked_by: args.values['blocked-by'] };
  }

  return {};
}
