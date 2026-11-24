import { match } from 'ts-pattern';
import type { Item, Note } from '../types.ts';
import { collectChangedIDs } from './collect-changed-ids.ts';
import { cutRanks } from './cut-ranks.ts';
import type { CutRank } from './cut-ranks.ts';
import { orderTasks } from './order-tasks.ts';

export interface OrderChecksInput {
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly focus: string | null;
  readonly pullRequests: readonly { readonly ref: string }[];
}

// The order a read starts its probes in, at most 8 at once until the 5 s deadline: the item in
// focus, then each rank of the cut order from the last cut to the first. Worked out before any
// cut. Only items with a check appear.
export function orderChecks(input: OrderChecksInput): string[] {
  const checked = new Set(input.items.filter((item) => item.check !== null).map((item) => item.id));

  const ordered = [
    ...(input.focus === null ? [] : [input.focus]),
    ...cutRanks.toReversed().flatMap((rank) => collectRankIDs(input, rank)),
  ];

  return ordered.filter(
    (id, index) => ordered.indexOf(id) === index && isChecked(id, checked, input),
  );
}

function collectRankIDs(input: OrderChecksInput, rank: CutRank): string[] {
  const ofKind = (kind: Item['kind'], isOwner?: boolean): string[] =>
    input.items
      .filter(
        (item) =>
          item.kind === kind && (isOwner === undefined || (item.extra.who === 'owner') === isOwner),
      )
      .map((item) => item.id);

  return match(rank)
    .with('waits-on-owner', () => ofKind('wait', true))
    .with('waits-on-others', () => ofKind('wait', false))
    .with('approval', () => ofKind('ok'))
    .with('tasks', () =>
      orderTasks({
        items: input.items,
        notes: input.notes,
        focus: input.focus,
        changedIDs: collectChangedIDs(input.items, []),
      }).map((item) => item.id),
    )
    .with('where', () => ofKind('where'))
    .with('pull-requests', () => input.pullRequests.map((pullRequest) => pullRequest.ref))
    .with('words', 'promises', 'rules', 'lessons', 'decisions', () => [])
    .exhaustive();
}

function isChecked(id: string, checked: ReadonlySet<string>, input: OrderChecksInput): boolean {
  return checked.has(id) || input.pullRequests.some((pullRequest) => pullRequest.ref === id);
}
