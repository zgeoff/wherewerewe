import { expect, test } from 'bun:test';
import { pickBriefBudget } from './pick-brief-budget.ts';

test.each([
  { host: 'claude', budget: { maxLines: 82, maxCharacters: 9000, taskRows: 15 } },
  { host: 'codex', budget: { maxLines: 73, maxCharacters: 7200, taskRows: 6 } },
  { host: null, budget: { maxLines: 73, maxCharacters: 7200, taskRows: 6 } },
] as const)('it picks the budget of the host $host', (row) => {
  expect(pickBriefBudget(row.host)).toStrictEqual(row.budget);
});
