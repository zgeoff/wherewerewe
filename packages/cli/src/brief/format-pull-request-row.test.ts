import { expect, test } from 'bun:test';
import { formatPullRequestRow } from './format-pull-request-row.ts';

test.each([
  {
    title: 'a short ref',
    ref: 'acme/tool#64',
    line: '  acme/tool#64  opened 3h ago  [OPEN pending]',
  },
  {
    title: 'a ref of 61 characters',
    ref: `${'p'.repeat(61)}`,
    line: `  ${'p'.repeat(59)}…  opened 3h ago  [OPEN pending]`,
  },
])('it formats $title', (row) => {
  const line = formatPullRequestRow(
    { ref: row.ref, opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
    Date.parse('2026-03-10T11:43:00Z'),
  );

  expect(line).toBe(row.line);
});
