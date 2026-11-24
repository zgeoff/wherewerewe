import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { collectUpgradeProblems } from './collect-upgrade-problems.ts';
import type { UpgradeApproval } from './collect-upgrade-problems.ts';

function setupTest() {
  const standing: UpgradeApproval = {
    id: 'ok-merge',
    quote: 'merge the garden-api PRs yourself once CI is green',
    scope: 'garden-api',
    written: '2026-03-03T09:00:00Z',
    use: 'standing',
  };

  const notFlags = [
    'import',
    'garden-beds',
    '--not',
    'replant the north beds',
    '--where',
    'chat',
    '--reading',
    'covers nothing yet',
  ];

  return {
    standing,
    notFlags,
    collect: (argv: readonly string[], approvals: readonly UpgradeApproval[]) =>
      collectUpgradeProblems({
        args: buildParsedArgs(argv),
        approvals,
        itemIDs: approvals.map((approval) => approval.id),
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
      }).map((problem) => problem.kind),
  };
}

test('it reports needs-grant for a standing approval and only --not', () => {
  const ctx = setupTest();

  expect(ctx.collect(ctx.notFlags, [ctx.standing])).toStrictEqual(['needs-grant']);
});

test('it reports no problem for only --not when no standing approval exists', () => {
  const ctx = setupTest();

  expect(ctx.collect(ctx.notFlags, [])).toStrictEqual([]);
});

test('it reports no problem for a standing approval and a --may bullet', () => {
  const ctx = setupTest();

  expect(
    ctx.collect([...ctx.notFlags, '--may', 'merge the garden-api PRs'], [ctx.standing]),
  ).toStrictEqual([]);
});
