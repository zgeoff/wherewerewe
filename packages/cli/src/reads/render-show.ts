import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import { renderGrantBullets } from '../brief/render-grant-bullets.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import { formatGrantText } from '../rules/format-grant-text.ts';
import { getKindWord } from '../rules/get-kind-word.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import { redactJoinedCredentials } from '../rules/redact-joined-credentials.ts';
import type { Item, JournalRow, LessonRow, PromiseRow, Store, WordsRow } from '../types.ts';
import { collectOpenIDs } from '../writes/collect-id-holders.ts';
import { cutRedactedLine } from './cut-redacted-line.ts';

interface CheckNow {
  readonly result: string;

  // the names of the checks that failed, from GitHub, after `OPEN failing`
  readonly failing: readonly string[];
}

export interface ShowInput {
  readonly id: string;
  readonly store: Store;

  readonly rows: readonly JournalRow[];

  // the ids the journal closed, so a wait whose rewrite an interrupted write lost reads as closed
  readonly closed: ReadonlyMap<string, string>;
  readonly nowMs: number;

  // what each item row with the id found just now, in file order; null for an item with no check
  readonly checkNows: readonly (CheckNow | null)[];
}

const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);

export function renderShow(input: ShowInput): string {
  if (input.id === 'grant') {
    return renderGrant(input);
  }

  // A store the older tool wrote can hold one id in two files, or twice in one: each row prints,
  // so none hides.
  const open = [
    ...input.store.items
      .filter((candidate) => candidate.id === input.id)
      .map((item, index) => renderOpenItem(input, item, input.checkNows[index] ?? null)),
    ...collectFileRows(input.store, input.id).map((found) => renderFileRow(input, found)),
  ];

  if (open.length > 0) {
    return open.join('\n');
  }

  const closing = input.rows.findLast(
    (row) => row.id === input.id && (row.op === 'done' || row.op === 'drop' || row.op === 'use'),
  );

  if (closing !== undefined) {
    return renderClosedItem(input, closing);
  }

  const decision = input.rows.find((row) => row.id === input.id && decisionOps.has(row.op));

  if (decision !== undefined) {
    return renderDecision(input, decision);
  }

  if (input.rows.some((row) => row.id === input.id)) {
    return `${[`${input.id}  not an item or a decision`, ...formatHistoryLines(input)].join('\n')}\n`;
  }

  const openIDs = collectOpenIDs(input.store);
  const openList = openIDs.length === 0 ? 'none' : openIDs.join(', ');

  return `${input.id}: no item, decision or journal row has this id. Open items: ${openList}.\n`;
}

const noGrantLine =
  'grant  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"';

// A write that stops after its journal row leaves a row `session` lacks. Only a full row at `set`
// and a `reading=1` row since count, and only when they hold the grant's words and where. A full
// row that also holds the reading wrote the words, so it wins over a newer full row.
function renderGrant(input: ShowInput): string {
  const grant = input.store.session.grant;

  if (grant === null) {
    return `${noGrantLine}\n`;
  }

  const setMs = Date.parse(grant.set);
  const rows = input.rows.filter((row) => row.id === 'grant' && row.op === 'grant');

  const held = rows.filter((row) => {
    const atMs = Date.parse(row.ts);
    const readingOnly = findExtraValue(row.extra, 'reading') === '1';

    return (
      (readingOnly ? atMs >= setMs : atMs === setMs) &&
      row.text === formatGrantText(grant) &&
      findExtraValue(row.extra, 'where') === grant.where
    );
  });

  const readingRow = held.findLast((row) => row.why === grant.reading);

  const wordsRow =
    readingRow !== undefined && findExtraValue(readingRow.extra, 'reading') !== '1'
      ? readingRow
      : held.findLast((row) => findExtraValue(row.extra, 'reading') !== '1');

  const wordsDay = getDay(input.store, Date.parse(wordsRow?.ts ?? grant.set));
  const readingDay = getDay(input.store, Date.parse(readingRow?.ts ?? grant.set));
  const wordsAge = formatAge(input.nowMs - Date.parse(grant.set));
  const readingAge = formatAge(input.nowMs - Date.parse(readingRow?.ts ?? grant.set));
  const days = rows.map((row) => `day ${String(getDay(input.store, Date.parse(row.ts)))} grant`);
  const scope = grant.scope === null ? '' : ` · ${grant.scope}`;

  const lines = [
    `grant  from the owner in ${grant.where}${scope}`,
    `  words (${wordsAge}), set on day ${String(wordsDay)} by ${wordsRow?.by ?? 'unknown'}:`,
    ...renderGrantBullets(grant),
    ...wrapBlock(
      grant.reading,
      `  reading (${readingAge}), set on day ${String(readingDay)}: `,
      '    ',
    ),
    ...(days.length === 0 ? [] : [`  journal: ${days.join(' · ')}`]),
  ];

  return `${lines.join('\n')}\n`;
}

function getDay(store: Store, timeMs: number): number {
  return getSessionDay(store.session.started, timeMs);
}

function renderOpenItem(input: ShowInput, item: Item, checkNow: CheckNow | null): string {
  const store = input.store;
  const first = input.rows.find((row) => row.id === item.id);
  const startedAt = first === undefined ? item.written : first.ts;
  const since = getDay(store, Date.parse(startedAt));

  const head = [
    `${item.id}  ${getKindWord(item.kind)}, open since day ${String(since)}, by ${item.by}`,
    ...(item.check === null ? [] : [`check: ${item.check}`]),
    ...(item.extra.who !== undefined && item.kind === 'wait' ? [`waits on ${item.extra.who}`] : []),
    ...(isBlocked(input, item) ? [`blocked by ${item.extra.blocked_by}`] : []),
  ].join(' · ');

  const age = formatAge(input.nowMs - Date.parse(item.written));

  const lines = [
    head,
    `  ${getClaimWord(item)} (${age}): ${item.claim}`,
    ...formatNoteLines(input, item),
    ...(item.kind === 'ok' ? [formatApprovalLine(item)] : []),
    ...(item.check === null ? [] : [formatCheckNowLine(checkNow, item)]),
    ...formatDecisionLines(input),
    ...formatHistoryLines(input),
  ];

  return `${lines.join('\n')}\n`;
}

function isBlocked(input: ShowInput, item: Item): boolean {
  const blocker = item.extra.blocked_by;

  return (
    blocker !== undefined &&
    !input.closed.has(blocker) &&
    input.store.items.some((candidate) => candidate.id === blocker)
  );
}

function getClaimWord(item: Item): string {
  return match(item.kind)
    .with('wait', () => 'what')
    .with('ok', () => 'quote')
    .with('task', 'rule', 'where', () => 'claim')
    .exhaustive();
}

function formatNoteLines(input: ShowInput, item: Item): string[] {
  const note = input.store.notes.find((candidate) => candidate.id === item.id);

  if (note === undefined) {
    return [];
  }

  const age = formatAge(input.nowMs - Date.parse(note.written));
  const label = `  ${note.owed ? 'owed note' : 'note'} (${age}): `;

  return wrapBlock(note.note, label, '    ');
}

function formatApprovalLine(item: Item): string {
  const who = item.extra.who ?? 'unknown';
  const where = item.extra.where ?? 'unknown';
  const scope = item.extra.scope ?? 'unknown';

  return `  given by ${who} in ${where} · scope: ${scope}`;
}

// Characters that print as a space or as nothing. The names come from outside the store, so each
// credential that such a character splits is redacted on the raw name, before the characters
// become spaces. The line then passes the redaction and the 100 character cut again.
const outsideSeparator = /[\s\p{Cc}\p{Cf}]/u;

function formatCheckNowLine(checkNow: CheckNow | null, item: Item): string {
  const now = checkNow ?? { result: 'unchecked', failing: [] };

  const names = now.failing
    .map((name) =>
      redactJoinedCredentials(name, outsideSeparator)
        .replaceAll(/[\s\p{Cc}\p{Cf}]/gu, ' ')
        .trim(),
    )
    .filter((name) => name !== '');

  const failing = now.result === 'OPEN failing' && names.length > 0 ? ` (${names.join(', ')})` : '';

  return cutRedactedLine(
    `  checked now: ${now.result}${failing} · at write: ${item.atWrite ?? 'not checked yet'}`,
  );
}

function formatDecisionLines(input: ShowInput): string[] {
  const decisions = input.rows
    .filter((row) => decisionOps.has(row.op) && findExtraValue(row.extra, 'on') === input.id)
    .map((row) => {
      const day = getDay(input.store, Date.parse(row.ts));
      const prefix = row.op === 'ruled-out' ? 'ruled out: ' : '';

      return `${row.id} ${prefix}${cutText(row.text ?? '')} (day ${String(day)})`;
    });

  return decisions.length === 0 ? [] : [`  decisions: ${decisions.join(' · ')}`];
}

const maxDecisionChars = 40;

function cutText(text: string): string {
  const characters = Array.from(text, (character) => character);

  return characters.length > maxDecisionChars
    ? `${characters.slice(0, maxDecisionChars).join('')}…`
    : text;
}

const maxJournalRows = 10;

function formatHistoryLines(input: ShowInput): string[] {
  const own = input.rows.filter((row) => row.id === input.id);
  const shown = own.slice(-maxJournalRows);

  const entries = shown.map(
    (row) => `day ${String(getDay(input.store, Date.parse(row.ts)))} ${row.op}`,
  );

  const more = own.length > shown.length ? '… · ' : '';

  return own.length === 0 ? [] : [`  journal: ${more}${entries.join(' · ')}`];
}

type FileRow =
  | { readonly kind: 'lesson'; readonly row: LessonRow }
  | { readonly kind: 'promise'; readonly row: PromiseRow }
  | { readonly kind: 'words'; readonly row: WordsRow };

function collectFileRows(store: Store, id: string): FileRow[] {
  return [
    ...store.lessons
      .filter((row) => row.id === id)
      .map((row): FileRow => ({ kind: 'lesson', row })),
    ...store.promises
      .filter((row) => row.id === id)
      .map((row): FileRow => ({ kind: 'promise', row })),
    ...store.words.filter((row) => row.id === id).map((row): FileRow => ({ kind: 'words', row })),
  ];
}

// A lesson, a promise or the owner's words, whole, each stored text redacted and none wrapped.
function renderFileRow(input: ShowInput, found: FileRow): string {
  const first = input.rows.find((row) => row.id === input.id);
  const startedAt = first === undefined ? found.row.written : first.ts;
  const since = getDay(input.store, Date.parse(startedAt));
  const age = formatAge(input.nowMs - Date.parse(found.row.written));
  const open = `open since day ${String(since)}, by ${found.row.by}`;

  const lines = match(found)
    .with({ kind: 'lesson' }, (lesson) => [
      `${lesson.row.id}  lesson, ${open}`,
      `  do this (${age}): ${redactCredential(lesson.row.text)}`,
      `  why: ${redactCredential(lesson.row.why)}`,
    ])
    .with({ kind: 'promise' }, (promise) => [
      `${promise.row.id}  promise, ${open} · to ${redactCredential(promise.row.to)} · by ${redactCredential(promise.row.byWhen)}`,
      `  what (${age}): ${redactCredential(promise.row.what)}`,
    ])
    .with({ kind: 'words' }, (words) => [
      `${words.row.id}  owner's words, ${open} · said in ${redactCredential(words.row.where)}`,
      `  words (${age}): "${redactCredential(words.row.words)}"`,
    ])
    .exhaustive();

  return `${[...lines, ...formatHistoryLines(input)].join('\n')}\n`;
}

function renderClosedItem(input: ShowInput, closing: JournalRow): string {
  const day = getDay(input.store, Date.parse(closing.ts));

  const [closedWord, whyLabel] = match(closing.op)
    .with('done', () => ['done', 'evidence'] as const)
    .with('drop', () => ['dropped', 'reason'] as const)
    .otherwise(() => ['used', 'used for'] as const);

  const lines = [
    `${input.id}  closed: ${closedWord} on day ${String(day)}, by ${closing.by}`,
    `  claim at close: ${closing.text ?? ''}`,
    `  ${whyLabel}: ${closing.why ?? ''}`,
    ...formatDecisionLines(input),
    ...formatHistoryLines(input),
  ];

  return `${lines.join('\n')}\n`;
}

function renderDecision(input: ShowInput, row: JournalRow): string {
  const on = findExtraValue(row.extra, 'on');
  const replaces = findExtraValue(row.extra, 'replaces');
  const who = findExtraValue(row.extra, 'who') ?? row.by;
  const day = getDay(input.store, Date.parse(row.ts));

  const replacedBy = input.rows
    .filter(
      (candidate) =>
        decisionOps.has(candidate.op) && findExtraValue(candidate.extra, 'replaces') === input.id,
    )
    .map((candidate) => candidate.id);

  const lines = [
    `${input.id}  ${row.op === 'ruled-out' ? 'ruled out' : 'decision'}${on === null ? '' : ` on ${on}`} · day ${String(day)} · by ${who}`,
    `  choice: ${row.text ?? ''}`,
    `  why: ${row.why ?? ''}`,
    ...(replaces === null ? [] : [`  replaces: ${replaces}`]),
    ...(replacedBy.length === 0 ? [] : [`  replaced by: ${replacedBy.join(', ')}`]),
    ...formatHistoryLines(input),
  ];

  return `${lines.join('\n')}\n`;
}
