import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { buildBindRow } from '../sessions/build-bind-row.ts';
import type { AgentID, Item, JournalRow, ParsedArgs, Refusal, SessionFile } from '../types.ts';
import { buildUpgradeParts, toApprovals } from './build-upgrade-parts.ts';
import { collectCapProblems } from './collect-cap-problems.ts';
import { collectImportFacts } from './collect-import-facts.ts';
import { collectItemChecks } from './collect-item-checks.ts';
import { collectJournalProblems } from './collect-journal-problems.ts';
import { collectSessionProblems } from './collect-session-problems.ts';
import { collectUpgradeProblems } from './collect-upgrade-problems.ts';
import type { HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts, Format1Item, JournalFact, Question } from './types.ts';

export type ImportPick =
  | {
      readonly kind: 'import';
      readonly session: SessionFile;
      readonly items: readonly Item[];
      readonly journal: readonly JournalRow[];
      readonly carried: number;
    }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

interface ImportOptions {
  readonly name: string;
  readonly args: ParsedArgs;
  readonly nowMs: number;
  readonly byOwner: boolean;
  readonly agent: AgentID | null;
}

export function pickImport(hand: HandKeptStore, options: ImportOptions): ImportPick {
  const facts = collectImportFacts(hand);
  const checks = collectItemChecks(hand, facts);
  const questions = facts.questions;
  const drops = options.args.values.drop ?? [];
  const questionItems = questions.map((question) => buildQuestionItem(question));
  const allItems = [...checks.items, ...questionItems];

  const rowProblems = [
    ...collectSessionProblems(hand, options.name, facts, checks.openIDs),
    ...checks.problems,
    ...collectJournalProblems(hand, facts, questions),
    ...collectCapProblems(
      new Map([...checks.openKinds].filter(([id, kind]) => kind !== 'ok' && !drops.includes(id))),
      questions.filter((question) => !drops.includes(question.id)),
    ),
  ];

  const problems = collectUpgradeProblems({
    args: options.args,
    approvals: toApprovals(allItems),
    itemIDs: [...new Set([...checks.openIDs.keys(), ...questions.map((question) => question.id)])],
    nowMs: options.nowMs,
  });

  if (rowProblems.length > 0 || problems.length > 0) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'upgrade-refused',
        args: options.args,
        name: options.name,
        rowProblems,
        problems,
      }),
    };
  }

  const parts = buildUpgradeParts(allItems, options.args.values, options);
  const converted = parts.items;
  const carried = facts.journal.map((row) => convertRow(row));
  const base = buildSession(hand, options.name, facts);

  return {
    kind: 'import',
    session: {
      ...base,
      grant: parts.grant,
      ...(base.now !== null && parts.removedIDs.has(base.now)
        ? { now: null, nowNext: null, nowSet: null }
        : {}),
    },
    items: converted,
    carried: carried.length,
    journal: [
      ...carried,
      ...parts.journalRows,
      {
        ts: formatTimestamp(options.nowMs),
        op: 'import',
        id: options.name,
        by: 'agent',
        text: '0-by-hand -> 2',
        why: null,
        extra: null,
      },
      ...(options.agent === null
        ? []
        : [buildBindRow(options.name, 'import', options.agent, options.nowMs)]),
    ],
  };
}

function buildQuestionItem(question: Question): Format1Item {
  return {
    id: question.id,
    kind: 'wait',
    claim: question.text,
    check: null,
    atWrite: null,
    last: null,
    written: question.ts,
    by: 'import',
    extra: { who: 'owner' },
  };
}

const decideSeparator = ' | why: ';

function convertRow(row: JournalFact): JournalRow {
  const base = { ts: row.ts, id: row.id, by: 'import' as const };

  if (row.op === 'decide') {
    const split = row.text.indexOf(decideSeparator);
    const hasReason = split !== -1;
    const choice = hasReason ? row.text.slice(0, split) : row.text;
    const reason = hasReason ? row.text.slice(split + decideSeparator.length) : '';

    return { ...base, op: 'decide', text: toText(choice), why: toText(reason), extra: null };
  }

  if (row.op === 'open') {
    return { ...base, op: 'wait', text: toText(row.text), why: null, extra: 'who=owner' };
  }

  if (row.op === 'closed') {
    return {
      ...base,
      op: 'done',
      text: toText(row.closedText),
      why: toText(row.text),
      extra: null,
    };
  }

  return { ...base, op: row.op, text: toText(row.text), why: null, extra: null };
}

function toText(cell: string | null | undefined): string | null {
  return cell === undefined || cell === null || cell === '' || cell === '-' ? null : cell;
}

function buildSession(hand: HandKeptStore, name: string, facts: Facts): Omit<SessionFile, 'grant'> {
  const pairs = new Map(
    hand.session.map((entry) => {
      const clean = stripCarriageReturn(entry.text);
      const split = clean.indexOf('=');

      return [clean.slice(0, split), clean.slice(split + 1)] as const;
    }),
  );

  const lastWrite = facts.journal.reduce((newest, row) => (row.ts > newest ? row.ts : newest), '');

  return {
    format: '2',
    name,
    goal: pairs.get('goal') ?? '',
    started: pairs.get('started') ?? '',
    now: toOptional(pairs.get('now')),
    nowNext: toOptional(pairs.get('now_next')),
    nowSet: toOptional(pairs.get('now_set')),
    lastWrite: toOptional(lastWrite),
    lastNudge: null,
    importedFrom: '0-by-hand',
  };
}

function toOptional(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}
