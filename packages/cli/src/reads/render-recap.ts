import { formatAge } from '../brief/format-age.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import { padID } from '../brief/pad-id.ts';
import { renderGrantLines } from '../brief/render-grant-lines.ts';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import type { Item, JournalRow, Note, SessionFile } from '../types.ts';
import { cutLine } from './cut-line.ts';

export interface RecapInput {
  readonly session: SessionFile;
  readonly items: readonly Item[];
  readonly notes: readonly Note[];

  // the journal rows at or after `fromMs`, any order; null when journal.tsv could not be read
  readonly rows: readonly JournalRow[] | null;

  // --since as typed, such as 24h, 3d or day-7
  readonly sinceText: string;

  // the --session value as typed, or null when the session came from the binding
  readonly sessionFlag: string | null;

  // the start of the window, never before `started`
  readonly fromMs: number;
  readonly nowMs: number;
}

// One screen of at most 55 lines of at most 100 characters. Each stored text is redacted before
// its line is cut. The grant's lines, the overflow lines and the footer are never cut, so each
// command runs as printed.
export function renderRecap(input: RecapInput): string {
  const lines = [
    renderHeader(input),
    ...renderGrant(input),
    ...renderNotes(input),
    ...renderRows(input),
    ...renderFooter(input),
  ];

  return `${lines.join('\n')}\n`;
}

function renderHeader(input: RecapInput): string {
  const session = input.session;
  const since = formatSince(input);

  const writes =
    input.rows === null
      ? 'journal unreadable'
      : `${String(input.rows.filter((row) => row.by === 'agent' || row.by === 'owner').length)} writes`;

  return cutLine(
    [
      session.name,
      `day ${String(getSessionDay(session.started, input.nowMs))}`,
      `recap since ${since} (${input.sinceText})`,
      writes,
    ].join(' · '),
  );
}

// `day <d> <HH:MMZ>` of the start of the window.
function formatSince(input: RecapInput): string {
  const day = getSessionDay(input.session.started, input.fromMs);

  return `day ${String(day)} ${new Date(input.fromMs).toISOString().slice(11, 16)}Z`;
}

function renderGrant(input: RecapInput): string[] {
  const grant = input.session.grant;

  return grant === null
    ? [`GRANT  none. Run: www --session ${input.session.name} show grant`]
    : renderGrantLines(grant, input.nowMs);
}

const maxNotes = 6;

function renderNotes(input: RecapInput): string[] {
  if (input.items.length === 0) {
    return [];
  }

  const noteOf = new Map(input.notes.map((note) => [note.id, note]));

  const noted = input.items.flatMap((item) => {
    const note = noteOf.get(item.id);

    return note === undefined ? [] : [{ item, note }];
  });

  const shown = noted
    .toSorted(
      (first, second) =>
        Number(second.note.owed) - Number(first.note.owed) ||
        Date.parse(second.note.written) - Date.parse(first.note.written),
    )
    .slice(0, maxNotes);

  const unnoted = input.items.filter((item) => !noteOf.has(item.id));
  const rest = noted.length - shown.length;

  return [
    cutLine(
      `NOTES (${String(shown.length)} of ${String(noted.length)} open items with a note) · owed first, then newest`,
    ),
    ...shown.flatMap((entry) => {
      const item = entry.item;
      const note = entry.note;
      const claim = redactCredentialWords(item.claim);
      const shownClaim = item.kind === 'ok' ? `"${claim}"` : claim;
      const age = formatAge(input.nowMs - Date.parse(note.written));
      const label = note.owed ? 'owed note' : 'note';

      return [
        cutLine(`  ${padID(redactCredentialWords(item.id))}${shownClaim}`),
        cutLine(`    ${label} (${age}): ${redactCredentialWords(note.note)}`),
      ];
    }),
    ...(rest > 0
      ? [
          `  and ${String(rest)} more with a note: www --session ${input.session.name} log --op note`,
        ]
      : []),
    ...(unnoted.length > 0
      ? [cutLine(`  no note: ${unnoted.map((item) => redactCredentialWords(item.id)).join(', ')}`)]
      : []),
  ];
}

const decisionOps: ReadonlySet<string> = new Set(['decide', 'ruled-out']);
const closeOps: ReadonlySet<string> = new Set(['done', 'drop', 'use']);

const closeWords: ReadonlyMap<string, string> = new Map([
  ['done', 'done'],
  ['drop', 'dropped'],
  ['use', 'used'],
]);

function renderRows(input: RecapInput): string[] {
  if (input.rows === null) {
    return [];
  }

  const since = formatSince(input);
  const session = input.session.name;

  const byTime = input.rows.toSorted(
    (first, second) => Date.parse(first.ts) - Date.parse(second.ts),
  );

  const decisions = byTime.filter((row) => decisionOps.has(row.op));
  const closes = byTime.filter((row) => closeOps.has(row.op));

  return [
    ...renderSection({
      heading: `DECIDED SINCE ${since} (${String(decisions.length)})`,
      rows: decisions,
      formatRow: (row) => {
        const choice = redactCredentialWords(row.text ?? '-');
        const reason = redactCredentialWords(row.why ?? '-');

        return `  ${redactCredentialWords(row.id)}  ${row.op === 'ruled-out' ? 'ruled out: ' : ''}${choice} · why: ${reason}`;
      },
      overflow: (rest) =>
        `  and ${String(rest)} more: www --session ${session} log --op decide,ruled-out --since ${input.sinceText}`,
    }),
    ...renderSection({
      heading: `CLOSED SINCE ${since} (${String(closes.length)})`,
      rows: closes,
      formatRow: (row) =>
        `  ${padID(redactCredentialWords(row.id))}${closeWords.get(row.op) ?? row.op} · ${redactCredentialWords(row.why ?? '-')}`,
      overflow: (rest) =>
        `  and ${String(rest)} more: www --session ${session} log --op done,drop,use --since ${input.sinceText}`,
    }),
  ];
}

interface Section {
  readonly heading: string;
  readonly rows: readonly JournalRow[];
  readonly formatRow: (row: JournalRow) => string;
  readonly overflow: (rest: number) => string;
}

const maxRows = 5;

function renderSection(section: Section): string[] {
  if (section.rows.length === 0) {
    return [];
  }

  const rest = section.rows.length - maxRows;

  return [
    cutLine(section.heading),
    ...section.rows.slice(0, maxRows).map((row) => cutLine(section.formatRow(row))),
    ...(rest > 0 ? [section.overflow(rest)] : []),
  ];
}

function renderFooter(input: RecapInput): string[] {
  const session = input.sessionFlag === null ? '' : ` --session ${input.sessionFlag}`;

  return [`Whole text: www${session} show <id>`, `Correct: www${session} say "<text>" [--on <id>]`];
}
