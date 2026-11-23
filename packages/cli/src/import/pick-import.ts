import { formatTimestamp } from '../format-timestamp.ts';
import { buildBindRow } from '../sessions/build-bind-row.ts';
import type { AgentID, Item, JournalRow, SessionFile } from '../types.ts';
import { collectCapProblems } from './collect-cap-problems.ts';
import { collectImportFacts } from './collect-import-facts.ts';
import { collectItemChecks } from './collect-item-checks.ts';
import { collectJournalProblems } from './collect-journal-problems.ts';
import { collectSessionProblems } from './collect-session-problems.ts';
import type { HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts, JournalFact, Question } from './types.ts';

export type ImportPick =
  | {
      readonly kind: 'import';
      readonly session: SessionFile;
      readonly items: readonly Item[];
      readonly journal: readonly JournalRow[];
      readonly carried: number;
    }
  | { readonly kind: 'refused'; readonly problems: readonly string[] };

interface ImportOptions {
  readonly name: string;
  readonly nowMs: number;
  readonly agent: AgentID | null;
}

export function pickImport(hand: HandKeptStore, options: ImportOptions): ImportPick {
  const facts = collectImportFacts(hand);
  const items = collectItemChecks(hand, facts);
  const questions = facts.questions;

  const problems = [
    ...collectSessionProblems(hand, options.name, facts, items.openIDs),
    ...items.problems,
    ...collectJournalProblems(hand, facts, questions),
    ...collectCapProblems(items.openKinds, questions),
  ];

  if (problems.length > 0) {
    return { kind: 'refused', problems };
  }

  const session = buildSession(hand, options.name, facts);
  const converted = [...items.items, ...questions.map((question) => buildQuestionItem(question))];
  const carried = facts.journal.map((row) => convertRow(row));

  return {
    kind: 'import',
    session,
    items: converted,
    carried: carried.length,
    journal: [
      ...carried,
      {
        ts: formatTimestamp(options.nowMs),
        op: 'import',
        id: options.name,
        by: 'agent',
        text: '0-by-hand -> 1',
        why: null,
        extra: null,
      },
      ...(options.agent === null
        ? []
        : [buildBindRow(options.name, 'import', options.agent, options.nowMs)]),
    ],
  };
}

function buildSession(hand: HandKeptStore, name: string, facts: Facts): SessionFile {
  const pairs = new Map(
    hand.session.map((entry) => {
      const clean = stripCarriageReturn(entry.text);
      const split = clean.indexOf('=');

      return [clean.slice(0, split), clean.slice(split + 1)] as const;
    }),
  );

  const lastWrite = facts.journal.reduce((newest, row) => (row.ts > newest ? row.ts : newest), '');

  return {
    format: '1',
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

function buildQuestionItem(question: Question): Item {
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
