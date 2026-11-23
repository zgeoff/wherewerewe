import type { Item } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatGoalLines } from './format-goal-lines.ts';
import { getSessionDay } from './get-session-day.ts';
import { pickFixCommand } from './pick-fix-command.ts';
import type { BriefInput } from './types.ts';

const maxCharacters = 6400;

// Renders every section of the brief in its order. When the text passes 6,400 characters, it
// drops item lines from the bottom up and says so.
export function renderBrief(input: BriefInput): string {
  const sections = buildItemSections(input);
  const cutOrder = [5, 4, 3, 2, 1, 0];
  const cuts: number[] = sections.map(() => 0);
  let cutCount = 0;
  let text = joinBrief(input, sections, cuts, cutCount);

  while (countCharacters(text) > maxCharacters) {
    const target = cutOrder.find(
      (index) => (sections[index]?.lines.length ?? 0) > (cuts[index] ?? 0),
    );

    if (target === undefined) {
      break;
    }

    cuts[target] = (cuts[target] ?? 0) + 1;
    cutCount += 1;
    text = joinBrief(input, sections, cuts, cutCount);
  }

  return text;
}

interface ItemSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

// The sections in the order of the brief: tasks, waits, approvals, rules, where items, then the
// pull requests that no item names. A section with no lines is left out when it joins the brief.
function buildItemSections(input: BriefInput): ItemSection[] {
  const items = input.items;
  const nowMs = input.nowMs;
  const focus = input.session.now;
  const ofKind = (kind: Item['kind']): Item[] => items.filter((item) => item.kind === kind);

  const tasks = [
    ...ofKind('task').filter((item) => item.id === focus),
    ...ofKind('task').filter((item) => item.id !== focus),
  ];

  const waits = ofKind('wait');
  const approvals = ofKind('ok');
  const rules = ofKind('rule');
  const whereItems = ofKind('where');

  return [
    {
      heading: `OPEN (${String(tasks.length)} of 6)`,
      lines: tasks.map((item) => itemLine(item, formatTaskTag(item, items, nowMs))),
    },
    {
      heading: `WAITING (${String(waits.length)} of 4)`,
      lines: waits.map((item) => itemLine(item, formatWaitTag(item, nowMs))),
    },
    {
      heading: `APPROVED (${String(approvals.length)} of 3) · act only inside each quote and scope`,
      lines: approvals.map(
        (item) =>
          `  ${padID(item.id)}"${item.claim}" · ${item.extra.use ?? 'once'} · ${item.extra.scope ?? ''}`,
      ),
    },
    {
      heading: `RULES (${String(rules.length)} of 5)`,
      lines: rules.map((item) => itemLine(item, null)),
    },
    {
      heading: `WHERE (${String(whereItems.length)} of 4)`,
      lines: whereItems.map((item) => itemLine(item, formatWhereTag(item, nowMs))),
    },
    renderPullRequests(input),
  ];
}

function itemLine(item: Item, tag: string | null): string {
  return `  ${padID(item.id)}${item.claim}${tag === null ? '' : `  [${tag}]`}`;
}

function padID(id: string): string {
  return id.length < 12 ? id.padEnd(12) : `${id}  `;
}

function formatTaskTag(item: Item, items: readonly Item[], nowMs: number): string {
  const blocker = item.extra.blocked_by;

  const isBlocked =
    blocker !== undefined &&
    items.some((other) => other.id === blocker && (other.kind === 'task' || other.kind === 'wait'));

  if (isBlocked) {
    return `blocked by ${blocker}${item.check === null ? '' : ` · ${formatResult(item)}`}`;
  }

  return item.check === null ? `no check · ${formatItemAge(item, nowMs)}` : formatResult(item);
}

function formatResult(item: Item): string {
  return item.last ?? 'not checked yet';
}

function formatItemAge(item: Item, nowMs: number): string {
  return formatAge(nowMs - Date.parse(item.written));
}

function formatWaitTag(item: Item, nowMs: number): string {
  const detail = item.check === null ? formatItemAge(item, nowMs) : formatResult(item);

  return `${item.extra.who ?? ''} · ${detail}`;
}

function formatWhereTag(item: Item, nowMs: number): string {
  return item.check === null ? `no check · ${formatItemAge(item, nowMs)}` : formatResult(item);
}

const maxPullRequestRows = 3;

function renderPullRequests(input: BriefInput): ItemSection {
  const pullRequests = input.pullRequests;
  const rest = pullRequests.length - maxPullRequestRows;

  const rows = pullRequests.slice(0, maxPullRequestRows).map((pullRequest) => {
    const ref =
      Array.from(pullRequest.ref, (character) => character).length > 60
        ? `${Array.from(pullRequest.ref, (character) => character)
            .slice(0, 59)
            .join('')}…`
        : pullRequest.ref;

    const age = formatAge(input.nowMs - Date.parse(pullRequest.opened));

    return `  ${ref}  opened ${age} ago  [${pullRequest.result}]`;
  });

  return {
    heading: `PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (${String(pullRequests.length)})`,
    lines:
      rows.length === 0
        ? []
        : [
            ...rows,
            ...(rest > 0 ? [`  and ${String(rest)} more: www log --op pr`] : []),
            '  name each in an item: www task <id> "<claim>" --pr <owner>/<repo>#<n>',
          ],
  };
}

const footer = [
  'Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.',
  'Close with www done <id> --evidence "<PR, commit or test run>" or www drop <id> --why "<reason>".',
  'More: www help · www show <id> · www log --since 24h · www decide "<choice>" --why "<reason>"',
];

function joinBrief(
  input: BriefInput,
  sections: readonly ItemSection[],
  cuts: readonly number[],
  cutCount: number,
): string {
  const kept = sections.map((section, index) => ({
    heading: section.heading,
    lines: section.lines.slice(0, section.lines.length - (cuts[index] ?? 0)),
  }));

  const lastKeptIndex = kept.findLastIndex((section) => section.lines.length > 0);
  const itemLines: string[] = [];

  for (const [index, section] of kept.entries()) {
    if (section.lines.length > 0) {
      itemLines.push(section.heading, ...section.lines);
    }

    if (section.lines.length > 0 && cutCount > 0 && index === lastKeptIndex) {
      itemLines.push(`  (${String(cutCount)} lines cut to fit; run www show <id>)`);
    }
  }

  const lines = [
    ...renderHeader(input),
    ...formatGoalLines(input.session.goal),
    ...renderOwnerNotes(input),
    ...renderChanged(input),
    ...renderNow(input),
    ...itemLines,
    ...footer,
  ];

  return `${lines.join('\n')}\n`;
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderHeader(input: BriefInput): string[] {
  const session = input.session;
  const nowMs = input.nowMs;

  const iso = new Date(nowMs).toISOString();

  const weekday = weekdays[new Date(nowMs).getUTCDay()] ?? '';

  const lastWrite =
    session.lastWrite === null
      ? 'last write never'
      : `last write ${formatAge(nowMs - Date.parse(session.lastWrite))} ago`;

  const first = [
    session.name,
    `day ${String(getSessionDay(session.started, nowMs))}`,
    `${weekday} ${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`,
    lastWrite,
    renderChecks(input.checks),
  ].join(' · ');

  if (input.resultsNotSaved === null) {
    return [first];
  }

  const reason =
    input.resultsNotSaved === 'not-writable'
      ? 'the store is not writable here'
      : 'another write held the lock';

  return [first, `  results not saved: ${reason}`];
}

function renderChecks(checks: BriefInput['checks']): string {
  if (checks.kind === 'none') {
    return 'no checks';
  }

  if (checks.kind === 'not-run') {
    return `${String(checks.count)} checks, not run yet`;
  }

  const unchecked =
    checks.unchecked === null
      ? ''
      : ` · ${String(checks.unchecked.count)} unchecked: ${checks.unchecked.reason}`;

  return `${String(checks.count)} checks in ${checks.seconds.toFixed(1)}s${unchecked}`;
}

function renderOwnerNotes(input: BriefInput): string[] {
  if (input.ownerNotes.length === 0) {
    return [];
  }

  return [
    `OWNER SAYS (${String(input.ownerNotes.length)}) · act on it; only the owner clears it`,
    ...input.ownerNotes.map((note) => {
      const age = formatAge(input.nowMs - Date.parse(note.said));

      return `  ${note.id}  ${note.text}  [${note.on === null ? age : `on ${note.on} · ${age}`}]`;
    }),
  ];
}

const maxChangedRows = 4;

function renderChanged(input: BriefInput): string[] {
  if (input.changed.length === 0) {
    return [];
  }

  const rows = input.changed.slice(0, maxChangedRows).map((change) => {
    const age = formatAge(input.nowMs - Date.parse(change.item.written));
    const fix = pickFixCommand(change.item, change.result);

    return `  ${padID(change.item.id)}was ${change.item.atWrite ?? 'not checked'} (${age}) · now ${change.result} · run: ${fix}`;
  });

  const rest = input.changed.length - maxChangedRows;

  return [
    `CHANGED SINCE WRITTEN (${String(input.changed.length)}) · these claims are no longer true`,
    ...rows,
    ...(rest > 0 ? [`  and ${String(rest)} more; each shows its result in its section below`] : []),
  ];
}

function renderNow(input: BriefInput): string[] {
  const session = input.session;
  const nowMs = input.nowMs;

  if (session.now === null) {
    return ['NOW  none. Run: www now <id> "<next step>"'];
  }

  const setAge =
    session.nowSet === null ? '' : ` · set ${formatAge(nowMs - Date.parse(session.nowSet))} ago`;

  return [
    `NOW  ${session.now}${setAge}`,
    ...(session.nowNext === null ? [] : [`  next: ${session.nowNext}`]),
  ];
}

function countCharacters(text: string): number {
  return Array.from(text, (character) => character).length;
}
