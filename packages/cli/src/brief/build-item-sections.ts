import { itemCaps } from '../rules/item-caps.ts';
import type { Item } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatItemLine } from './format-item-line.ts';
import { formatTaskLine } from './format-task-line.ts';
import { padID } from './pad-id.ts';
import type { BriefInput, ItemLine, ItemSection } from './types.ts';
import { withOwed } from './with-owed.ts';

// The sections in the order of the brief: tasks, waits, approvals, rules, where items, then the
// pull requests that no item names. A section with no lines is left out when it joins the brief.
export function buildItemSections(
  input: BriefInput,
  orderedTasks: readonly Item[],
  shownTasks: number,
): ItemSection[] {
  const items = input.items;
  const nowMs = input.nowMs;
  const ofKind = (kind: Item['kind']): Item[] => items.filter((item) => item.kind === kind);

  const isOwed = (item: Item): boolean =>
    input.notes.some((note) => note.id === item.id && note.owed);

  const waits = ofKind('wait');
  const approvals = ofKind('ok');
  const rules = ofKind('rule');
  const whereItems = ofKind('where');
  const leftOut = orderedTasks.length - shownTasks;

  return [
    {
      heading: `OPEN (${String(orderedTasks.length)}, max ${String(itemCaps.task)})`,
      lines: orderedTasks
        .slice(0, shownTasks)
        .map((item) => buildRow(item, formatTaskLine(item, items, input.notes, nowMs))),
      tail: leftOut > 0 ? formatCountLine(leftOut, input.sessionFlag) : null,
    },
    {
      heading: `WAITING (${String(waits.length)}, max ${String(itemCaps.wait)})`,
      lines: waits.map((item) => formatTaggedRow(item, formatWaitTag(item, nowMs), isOwed(item))),
      tail: null,
    },
    {
      heading: `APPROVED ONCE (${String(approvals.length)}, max ${String(itemCaps.ok)})`,
      lines: approvals.map((item) =>
        buildRow(
          item,
          `  ${padID(item.id)}"${item.claim}" · ${item.extra.scope ?? ''}${isOwed(item) ? '  [owed]' : ''}`,
        ),
      ),
      tail: null,
    },
    {
      heading: `RULES (${String(rules.length)}, max ${String(itemCaps.rule)})`,
      lines: rules.map((item) =>
        buildRow(item, `${formatItemLine(item, null)}${isOwed(item) ? '  [owed]' : ''}`),
      ),
      tail: null,
    },
    {
      heading: `WHERE (${String(whereItems.length)}, max ${String(itemCaps.where)})`,
      lines: whereItems.map((item) =>
        formatTaggedRow(item, formatWhereTag(item, nowMs), isOwed(item)),
      ),
      tail: null,
    },
    renderPullRequests(input),
  ];
}

function buildRow(item: Item, text: string): ItemLine {
  return { text, id: item.id };
}

function formatCountLine(leftOut: number, sessionFlag: string | null): string {
  const command = sessionFlag === null ? 'www show' : `www --session ${sessionFlag} show`;

  return `  and ${String(leftOut)} more open tasks: ${command}`;
}

function formatTaggedRow(item: Item, tag: string, isOwed: boolean): ItemLine {
  return buildRow(item, formatItemLine(item, withOwed(tag, isOwed)));
}

function formatWaitTag(item: Item, nowMs: number): string {
  const detail = item.check === null ? formatItemAge(item, nowMs) : formatResult(item);

  return `${item.extra.who ?? ''} · ${detail}`;
}

function formatItemAge(item: Item, nowMs: number): string {
  return formatAge(nowMs - Date.parse(item.written));
}

function formatResult(item: Item): string {
  return item.last ?? 'not checked yet';
}

function formatWhereTag(item: Item, nowMs: number): string {
  return item.check === null ? `no check · ${formatItemAge(item, nowMs)}` : formatResult(item);
}

const maxPullRequestRows = 1;

function renderPullRequests(input: BriefInput): ItemSection {
  const pullRequests = input.pullRequests;
  const rest = pullRequests.length - maxPullRequestRows;

  const rows = pullRequests.slice(0, maxPullRequestRows).map((pullRequest): ItemLine => {
    const ref =
      Array.from(pullRequest.ref, (character) => character).length > 60
        ? `${Array.from(pullRequest.ref, (character) => character)
            .slice(0, 59)
            .join('')}…`
        : pullRequest.ref;

    const age = formatAge(input.nowMs - Date.parse(pullRequest.opened));

    return { text: `  ${ref}  opened ${age} ago  [${pullRequest.result}]`, id: null };
  });

  return {
    heading: `PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (${String(pullRequests.length)})`,
    lines:
      rows.length === 0
        ? []
        : [
            ...rows,
            ...(rest > 0
              ? [{ text: `  and ${String(rest)} more: www log --op pr`, id: null }]
              : []),
            {
              text: '  name each in an item: www task <id> "<claim>" --pr <owner>/<repo>#<n>',
              id: null,
            },
          ],
    tail: null,
  };
}
