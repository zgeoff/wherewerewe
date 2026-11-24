import { formatAge } from '../brief/format-age.ts';
import type { ApprovalLine, ParsedArgs, UpgradeProblem } from '../types.ts';
import { pickGrantPartsRefusal } from '../writes/pick-grant-parts-refusal.ts';
import { pickGrantTextRefusals } from '../writes/pick-grant-text-refusal.ts';

// An approval the upgrade or the import reads: standing ones fold into the grant, one-time ones stay.
export interface UpgradeApproval {
  readonly id: string;
  readonly quote: string;
  readonly scope: string;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;
  readonly use: 'once' | 'standing';
}

interface UpgradeFacts {
  readonly args: ParsedArgs;
  readonly approvals: readonly UpgradeApproval[];

  // the id of every item the store holds
  readonly itemIDs: readonly string[];
  readonly nowMs: number;
}

// What stops an upgrade or an import before it writes, in the order the refusal prints it. A
// standing approval counts even when --drop names it, so the brief shows the approvals or the grant
// on every day.
export function collectUpgradeProblems(facts: UpgradeFacts): UpgradeProblem[] {
  const args = facts.args;

  const drops = new Set(args.values.drop);

  const standing = facts.approvals.filter((approval) => approval.use === 'standing');

  const once = facts.approvals.filter(
    (approval) => approval.use === 'once' && !drops.has(approval.id),
  );

  const partsReason = pickGrantPartsRefusal(args, false);
  const textReasons = pickGrantTextRefusals(args);

  return [
    ...(standing.length > 0 && args.values.may === undefined
      ? [
          {
            kind: 'needs-grant' as const,
            approvals: standing.map((approval) => toLine(approval, null)),
          },
        ]
      : []),
    ...(once.length > 1
      ? [
          {
            kind: 'too-many-once' as const,
            approvals: once.map((approval) =>
              toLine(approval, formatAge(facts.nowMs - Date.parse(approval.written))),
            ),
          },
        ]
      : []),
    ...(facts.itemIDs.includes('grant') && !drops.has('grant')
      ? [{ kind: 'grant-id' as const }]
      : []),
    ...(partsReason === null ? [] : [{ kind: 'grant-needs-part' as const }]),
    ...textReasons.map((reason) => ({ kind: 'grant-text' as const, reason })),
    ...[...drops]
      .filter((id) => !facts.itemIDs.includes(id))
      .map((id) => ({ kind: 'drop-unknown' as const, id, open: facts.itemIDs })),
  ];
}

function toLine(approval: UpgradeApproval, age: string | null): ApprovalLine {
  return {
    id: approval.id,
    quote: approval.quote,
    scope: approval.scope,
    written: approval.written,
    age,
  };
}
