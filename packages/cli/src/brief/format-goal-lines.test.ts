import { expect, test } from 'bun:test';
import { formatGoalLines } from './format-goal-lines.ts';

test('it keeps a short goal on one line after GOAL', () => {
  expect(formatGoalLines('Ship it')).toStrictEqual(['GOAL  Ship it']);
});

test('it wraps at 100 columns at spaces and indents each further line by 6', () => {
  const goal =
    'Ship tide alerts in bosun-api and bosun-app: a push alert 2 hours before low water at a saved harbour, behind the tide_alerts flag. Done when alerts-e2e passes on staging.';

  const lines = formatGoalLines(goal);

  expect(lines).toStrictEqual([
    'GOAL  Ship tide alerts in bosun-api and bosun-app: a push alert 2 hours before low water at a saved',
    '      harbour, behind the tide_alerts flag. Done when alerts-e2e passes on staging.',
  ]);
});

test('it cuts a word longer than a line', () => {
  const lines = formatGoalLines('x'.repeat(150));

  expect(lines).toStrictEqual([`GOAL  ${'x'.repeat(94)}`, `      ${'x'.repeat(56)}`]);
});
