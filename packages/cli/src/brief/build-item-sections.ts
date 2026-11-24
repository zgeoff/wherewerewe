import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Item } from '../types.ts';
import type { CutRank } from './cut-ranks.ts';
import { formatAge } from './format-age.ts';
import { formatCheckResult } from './format-check-result.ts';
import { formatItemLine } from './format-item-line.ts';
import { formatListCommand } from './format-list-command.ts';
import { formatPullRequestRow } from './format-pull-request-row.ts';
import { formatTaskLine } from './format-task-line.ts';
import { padID } from './pad-id.ts';
import type { BriefInput, CutKind, ItemLine, ItemSection } from './types.ts';
import { withOwed } from './with-owed.ts';

const maxDecisionRows = 3;

// The sections after the owner notes, each with every row it has: the owner's words, which print
// before the changed rows, then tasks, waits, promises, approvals, rules, lessons, decisions, where
// items and the pull requests no item names. A section with no rows is left out when it joins.
export function buildItemSections(input: BriefInput, orderedTasks: readonly Item[]): ItemSection[] {
  const items = input.items;
  const nowMs = input.nowMs;
  const focus = input.session.now;
  const ofKind = (kind: Item['kind']): Item[] => items.filter((item) => item.kind === kind);

  const isOwed = (item: Item): boolean =>
    input.notes.some((note) => note.id === item.id && note.owed);

  const rank = (id: string, other: CutRank): CutRank | null => (id === focus ? null : other);
  const waits = ofKind('wait');
  const approvals = ofKind('ok');
  const rules = ofKind('rule');
  const whereItems = ofKind('where');
  const listCommand = (kind: string): string => formatListCommand(kind, input.sessionFlag);

  const words = input.words.toSorted((first, second) =>
    first.written.localeCompare(second.written),
  );

  const wordsSection: ItemSection = {
    ...cutSection(
      `WORDS (${String(words.length)}, max ${String(wordsCap)})`,
      words.map((row) => ({
        text: `  ${padID(row.id)}"${redactCredential(row.words)}"  [${redactCredential(row.where)} · ${formatAge(nowMs - Date.parse(row.written))}]`,
        id: row.id,
        rank: 'words',
      })),
      'words',
    ),
    isEarly: true,
  };

  const promises = input.promises.toSorted((first, second) =>
    first.written.localeCompare(second.written),
  );

  const lessons = input.lessons.toSorted((first, second) =>
    first.written.localeCompare(second.written),
  );

  const decisionRows = input.decisions.slice(0, maxDecisionRows);

  return [
    wordsSection,
    {
      heading: `OPEN (${String(orderedTasks.length)}, max ${String(itemCaps.task)})`,
      lines: orderedTasks.map((item) =>
        buildRow(
          item,
          formatTaskLine(item, { items, notes: input.notes, nowMs, results: input.results }),
          rank(item.id, 'tasks'),
        ),
      ),
      count: (kept) =>
        orderedTasks.length > kept
          ? `  and ${String(orderedTasks.length - kept)} more open tasks: ${formatShowCommand(input.sessionFlag)}`
          : null,
      cutKind: null,
      after: null,
      isEarly: false,
    },
    cutSection(
      `WAITING (${String(waits.length)}, max ${String(itemCaps.wait)})`,
      waits.map((item) =>
        formatTaggedRow(
          item,
          formatWaitTag(item, nowMs, input.results),
          isOwed(item),
          rank(item.id, pickWaitRank(item)),
        ),
      ),
      'waits',
    ),
    cutSection(
      `PROMISED (${String(promises.length)}, max ${String(promiseCap)})`,
      promises.map((row) => ({
        text: `  ${padID(row.id)}${redactCredential(row.what)}  [to ${redactCredential(row.to)} · by ${redactCredential(row.byWhen)}]`,
        id: row.id,
        rank: rank(row.id, 'promises'),
      })),
      'promises',
    ),
    cutSection(
      `APPROVED ONCE (${String(approvals.length)}, max ${String(itemCaps.ok)})`,
      approvals.map((item) =>
        buildRow(
          item,
          `  ${padID(item.id)}"${item.claim}" · ${item.extra.scope ?? ''}${isOwed(item) ? '  [owed]' : ''}`,
          rank(item.id, 'approval'),
        ),
      ),
      'approvals',
    ),
    cutSection(
      `RULES (${String(rules.length)}, max ${String(itemCaps.rule)})`,
      rules.map((item) =>
        buildRow(
          item,
          `${formatItemLine(item, null)}${isOwed(item) ? '  [owed]' : ''}`,
          rank(item.id, 'rules'),
        ),
      ),
      'rules',
    ),
    cutSection(
      `LESSONS (${String(lessons.length)}, max ${String(lessonCap)})`,
      lessons.map((row) => ({
        text: `  ${padID(row.id)}${redactCredential(row.text)}  [why: ${redactCredential(row.why)}]`,
        id: row.id,
        rank: rank(row.id, 'lessons'),
      })),
      'lessons',
    ),
    {
      heading: `DECISIONS (${String(input.decisions.length)} in force)`,
      lines: decisionRows.map((row) => ({
        text: `  ${row.id}  ${cutDecision(redactCredential(row.choice))}`,
        id: null,
        rank: 'decisions',
      })),
      count: () =>
        input.decisions.length > maxDecisionRows
          ? `  and ${String(input.decisions.length - maxDecisionRows)} more: ${listCommand('decisions')}`
          : null,
      cutKind: 'decisions',
      after: null,
      isEarly: false,
    },
    cutSection(
      `WHERE (${String(whereItems.length)}, max ${String(itemCaps.where)})`,
      whereItems.map((item) =>
        formatTaggedRow(
          item,
          formatWhereTag(item, nowMs, input.results),
          isOwed(item),
          rank(item.id, 'where'),
        ),
      ),
      'where',
    ),
    buildPullRequests(input),
  ];
}

function cutSection(heading: string, lines: readonly ItemLine[], cutKind: CutKind): ItemSection {
  return { heading, lines, count: () => null, cutKind, after: null, isEarly: false };
}

function buildRow(item: Item, text: string, rank: CutRank | null): ItemLine {
  return { text, id: item.id, rank };
}

function formatShowCommand(sessionFlag: string | null): string {
  return sessionFlag === null ? 'www show' : `www --session ${sessionFlag} show`;
}

function formatTaggedRow(item: Item, tag: string, isOwed: boolean, rank: CutRank | null): ItemLine {
  return buildRow(item, formatItemLine(item, withOwed(tag, isOwed)), rank);
}

function formatWaitTag(item: Item, nowMs: number, results: ReadonlyMap<string, string>): string {
  const detail =
    item.check === null ? formatItemAge(item, nowMs) : formatCheckResult(item, results);

  return `${item.extra.who ?? ''} · ${detail}`;
}

function formatItemAge(item: Item, nowMs: number): string {
  return formatAge(nowMs - Date.parse(item.written));
}

function pickWaitRank(item: Item): CutRank {
  return item.extra.who === 'owner' ? 'waits-on-owner' : 'waits-on-others';
}

const maxDecisionCharacters = 200;

function cutDecision(choice: string): string {
  const characters = Array.from(choice, (character) => character);

  return characters.length > maxDecisionCharacters
    ? `${characters.slice(0, maxDecisionCharacters - 1).join('')}…`
    : choice;
}

function formatWhereTag(item: Item, nowMs: number, results: ReadonlyMap<string, string>): string {
  return item.check === null
    ? `no check · ${formatItemAge(item, nowMs)}`
    : formatCheckResult(item, results);
}

const maxPullRequestRows = 1;

// The section prints its row, then its overflow line, then its hint. The cut drops the row, and
// the hint with it; the overflow line stays and counts every pull request the section does not
// print.
function buildPullRequests(input: BriefInput): ItemSection {
  const pullRequests = input.pullRequests;

  const rows = pullRequests.slice(0, maxPullRequestRows).map((pullRequest): ItemLine => ({
    text: formatPullRequestRow(pullRequest, input.nowMs),
    id: null,
    rank: 'pull-requests',
  }));

  return {
    heading: `PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (${String(pullRequests.length)})`,
    lines: rows,
    count: (kept) =>
      pullRequests.length > kept
        ? `  and ${String(pullRequests.length - kept)} more: ${formatListCommand('prs', input.sessionFlag)}`
        : null,
    cutKind: null,
    after: '  name each in an item: www task <id> "<claim>" --pr <owner>/<repo>#<n>',
    isEarly: false,
  };
}
