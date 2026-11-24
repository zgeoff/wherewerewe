import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import { checkHeader } from './check-header.ts';
import { carriageReturnProblem, idRuleProblem } from './constants.ts';
import type { HandKeptStore } from './parse-hand-kept-store.ts';
import type { Facts, Question } from './types.ts';

const handKeptJournalHeader = 'ts\top\tid\ttext';

export function collectJournalProblems(
  hand: HandKeptStore,
  facts: Facts,
  questions: readonly Question[],
): string[] {
  const headerProblems = checkHeader(
    'journal.tsv',
    hand.journal.header,
    handKeptJournalHeader,
    'ts, op, id, text',
  );

  const itemLines = new Map<string, number>();

  for (const row of facts.itemRows) {
    if (!facts.settledIDs.has(row.cells[0] ?? '') && !itemLines.has(row.cells[0] ?? '')) {
      itemLines.set(row.cells[0] ?? '', row.line);
    }
  }

  const factsByLine = new Map(facts.journal.map((row) => [row.line, row]));
  const questionsByLine = new Map(questions.map((question) => [question.line, question]));
  const reopenedByLine = new Map(facts.reopened.map((question) => [question.line, question]));
  const seenQuestions = new Map<string, number>();

  const lines: string[] = [];

  for (const row of hand.journal.rows) {
    const fact = factsByLine.get(row.line);

    if (fact === undefined) {
      lines.push(
        `journal.tsv line ${String(row.line)}: the row has ${String(row.cells.length)} columns, and a hand-kept journal row has 4.`,
      );
    } else {
      const question = questionsByLine.get(row.line);

      const credential =
        [fact.ts, fact.op, fact.id, fact.text, fact.closedText ?? '']
          .map((cell) => findCredentialMatch(cell))
          .find((found) => found !== null) ?? null;

      const reopened = reopenedByLine.get(row.line);

      const problems = [
        ...(reopened === undefined ? [] : [buildReuseProblem(reopened)]),
        ...(question === undefined
          ? []
          : collectQuestionProblems(question, itemLines, seenQuestions)),
        ...(credential === null
          ? []
          : [`the text looks like a credential (it matches the ${credential} pattern).`]),
        ...(fact.hasCarriageReturn ? [carriageReturnProblem] : []),
      ];

      if (question !== undefined) {
        seenQuestions.set(question.id, row.line);
      }

      if (problems.length > 0) {
        lines.push(
          `journal.tsv line ${String(row.line)} (${redactCredential(fact.id)}): ${problems.join('; ')}`,
        );
      }
    }
  }

  return [...headerProblems, ...lines];
}

function buildReuseProblem(question: Question): string {
  return `line ${String(question.closedLine)} closed the id, and a closed id is never reused.`;
}

function collectQuestionProblems(
  question: Question,
  itemLines: ReadonlyMap<string, number>,
  seenQuestions: ReadonlyMap<string, number>,
): string[] {
  const textProblem = findTextProblem(question.text, 120);
  const itemLine = itemLines.get(question.id);
  const questionLine = seenQuestions.get(question.id);

  return [
    ...(textProblem?.kind === 'empty' ? ['the question is empty.'] : []),
    ...(textProblem?.kind === 'too-long'
      ? [
          `the question is ${String(textProblem.length)} characters, and the limit is 120 for a wait.`,
        ]
      : []),
    ...(isItemID(question.id) || question.id === 'grant' ? [] : [idRuleProblem]),
    ...(question.closedLine === null ? [] : [buildReuseProblem(question)]),
    ...(itemLine === undefined ? [] : [`items.tsv line ${String(itemLine)} has the same id.`]),
    ...(questionLine === undefined ? [] : [`line ${String(questionLine)} has the same id.`]),
  ];
}
