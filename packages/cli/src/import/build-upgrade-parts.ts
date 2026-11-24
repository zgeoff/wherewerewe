import { formatTimestamp } from '../format-timestamp.ts';
import { formatGrantText } from '../rules/format-grant-text.ts';
import type { Extra, Grant, Item, JournalRow, ParsedArgs } from '../types.ts';
import { toGrantWords } from '../writes/to-grant-words.ts';
import type { UpgradeApproval } from './collect-upgrade-problems.ts';
import type { Format1Item } from './types.ts';

interface UpgradeOptions {
  readonly nowMs: number;
  readonly byOwner: boolean;
}

export interface UpgradeParts {
  readonly grant: Grant | null;

  // the items that stay, without a use key
  readonly items: readonly Item[];

  // ids of the items the conversion removes
  readonly removedIDs: ReadonlySet<string>;

  // the drop rows, then the grant row when there is a grant, in the order they are written
  readonly journalRows: readonly JournalRow[];

  // standing approvals removed
  readonly folded: number;

  // one-time approvals kept, 0 or 1
  readonly kept: number;
}

const foldedWhy = 'folded into the grant by the format 2 upgrade';
const droppedWhy = 'dropped by the format 2 upgrade';

export function toApprovals(items: readonly Format1Item[]): UpgradeApproval[] {
  return items.flatMap((item): UpgradeApproval[] =>
    item.kind === 'ok'
      ? [
          {
            id: item.id,
            quote: item.claim,
            scope: item.extra.scope ?? '',
            written: item.written,
            use: isStanding(item) ? 'standing' : 'once',
          },
        ]
      : [],
  );
}

// What a conversion to format 2 does with the items and the grant flags, once its checks pass: a
// standing approval and each item --drop names go, with a drop row each, and the flags make the
// grant and its journal row.
export function buildUpgradeParts(
  items: readonly Format1Item[],
  args: ParsedArgs,
  options: UpgradeOptions,
): UpgradeParts {
  const flags = args.values;

  const drops = new Set(flags.drop);

  const removed = items.filter((item) => isStanding(item) || drops.has(item.id));
  const ts = formatTimestamp(options.nowMs);

  const grant: Grant | null =
    flags.may === undefined
      ? null
      : {
          ...toGrantWords(args),
          reading: flags.reading ?? '',
          where: flags.where ?? '',
          set: ts,
        };

  const dropRows = removed.map((item): JournalRow => ({
    ts,
    op: 'drop',
    id: item.id,
    by: 'agent',
    text: item.claim,
    why: isStanding(item) ? foldedWhy : droppedWhy,
    extra: null,
  }));

  const removedIDs = new Set(removed.map((item) => item.id));

  return {
    grant,
    items: items.filter((item) => !removedIDs.has(item.id)).map((item) => toItem(item)),
    removedIDs,
    journalRows: [
      ...dropRows,
      ...(grant === null
        ? []
        : [
            {
              ts,
              op: 'grant',
              id: 'grant',
              by: options.byOwner ? 'owner' : 'agent',
              text: formatGrantText(grant),
              why: grant.reading,
              extra: `where=${grant.where}`,
            } satisfies JournalRow,
          ]),
    ],
    folded: removed.filter((item) => isStanding(item)).length,
    kept: items.filter((item) => item.kind === 'ok' && !removedIDs.has(item.id)).length,
  };
}

function isStanding(item: Format1Item): boolean {
  return item.kind === 'ok' && item.extra.use === 'standing';
}

function toItem(item: Format1Item): Item {
  const extra: Extra = {
    ...(item.extra.who === undefined ? {} : { who: item.extra.who }),
    ...(item.extra.where === undefined ? {} : { where: item.extra.where }),
    ...(item.extra.scope === undefined ? {} : { scope: item.extra.scope }),
    ...(item.extra.blocked_by === undefined ? {} : { blocked_by: item.extra.blocked_by }),
    ...(item.extra.pid_start === undefined ? {} : { pid_start: item.extra.pid_start }),
  };

  return { ...item, extra };
}
