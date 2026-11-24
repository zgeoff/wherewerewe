import { itemCaps } from '../rules/item-caps.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Kind } from '../types.ts';
import type { Question } from './types.ts';

const capWords = {
  task: { cap: itemCaps.task, plural: 'tasks' },
  wait: { cap: itemCaps.wait, plural: 'waits' },
  ok: { cap: 3, plural: 'approvals' },
  rule: { cap: itemCaps.rule, plural: 'rules' },
  where: { cap: itemCaps.where, plural: 'where items' },
} as const;

export function collectCapProblems(
  openKinds: ReadonlyMap<string, Kind>,
  questions: readonly Question[],
): string[] {
  return (['task', 'wait', 'ok', 'rule', 'where'] as const).flatMap((kind) => {
    const fromItems = [...openKinds].filter(([, itemKind]) => itemKind === kind).map(([id]) => id);
    const fromQuestions = kind === 'wait' ? questions.map((question) => question.id) : [];
    const ids = [...fromItems, ...fromQuestions];
    const words = capWords[kind];

    if (ids.length <= words.cap) {
      return [];
    }

    const source = pickSource(fromItems.length, fromQuestions.length);

    return [
      `${source}: ${String(ids.length)} open ${words.plural} (${ids.map((id) => redactCredential(id)).join(', ')}), and the limit is ${String(words.cap)}. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ];
  });
}

function pickSource(itemCount: number, questionCount: number): string {
  if (itemCount === 0) {
    return 'journal.tsv';
  }

  return questionCount === 0 ? 'items.tsv' : 'items.tsv and journal.tsv';
}
