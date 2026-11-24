import { match } from 'ts-pattern';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import type { Note } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatGoalLines } from './format-goal-lines.ts';
import { formatListCommand } from './format-list-command.ts';
import { getSessionDay } from './get-session-day.ts';
import { padID } from './pad-id.ts';
import { pickFixCommand } from './pick-fix-command.ts';
import { renderGrantLines } from './render-grant-lines.ts';
import type { BriefInput, ItemSection } from './types.ts';
import { wrapBlock } from './wrap-block.ts';

export const briefFooter =
  'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help';

// The brief's text with the sections' kept rows, after the redaction `runCLI` runs on all output.
// No credential spans a line break, so each line redacts on its own, and a caller that joins the
// same lines again passes a redactor that remembers them.
export function joinBrief(
  input: BriefInput,
  sections: readonly ItemSection[],
  cuts: readonly (readonly boolean[])[],
  redactLine: (line: string) => string = redactCredentialWords,
): string {
  const early: string[] = [];
  const late: string[] = [];

  for (const [index, section] of sections.entries()) {
    if (section.lines.length === 0) {
      continue;
    }

    const kept = section.lines.filter((_line, lineIndex) => cuts[index]?.[lineIndex] !== true);
    const dropped = section.lines.length - kept.length;
    const count = section.count(kept.length);

    const lines = [
      section.heading,
      ...kept.map((line) => line.text),
      ...(count === null ? [] : [count]),
      ...(section.cutKind !== null && dropped > 0
        ? [
            `  and ${String(dropped)} more: ${formatListCommand(section.cutKind, input.sessionFlag)}`,
          ]
        : []),
      ...(section.after !== null && kept.length > 0 ? [section.after] : []),
    ];

    (section.isEarly ? early : late).push(...lines);
  }

  const lines = [
    ...renderHeader(input),
    ...formatGoalLines(input.session.goal),
    ...renderGrant(input),
    ...renderOwnerNotes(input),
    ...early,
    ...renderChanged(input),
    ...renderNow(input),
    ...late,
    briefFooter,
  ];

  return `${lines.map((line) => redactLine(line)).join('\n')}\n`;
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

  const reason = match(input.resultsNotSaved)
    .with(null, () => null)
    .with('not-writable', () => 'the store is not writable here')
    .with('lock-held', () => 'another write held the lock')
    .exhaustive();

  return reason === null ? [first] : [first, `  results not saved: ${reason}`];
}

function renderChecks(checks: BriefInput['checks']): string {
  return match(checks)
    .with({ kind: 'none' }, () => 'no checks')
    .with({ kind: 'not-run' }, (notRun) => `${String(notRun.count)} checks, not run yet`)
    .with({ kind: 'ran' }, (ran) => {
      const unchecked =
        ran.unchecked === null
          ? ''
          : ` · ${String(ran.unchecked.count)} unchecked: ${ran.unchecked.reason}`;

      return `${String(ran.count)} checks in ${ran.seconds.toFixed(1)}s${unchecked}`;
    })
    .exhaustive();
}

const noGrantLine =
  'GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"';

function renderGrant(input: BriefInput): string[] {
  const grant = input.session.grant;

  if (grant === null) {
    return [noGrantLine];
  }

  return renderGrantLines(grant, input.nowMs);
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

const maxChangedRows = 3;

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
    ...(rest > 0
      ? [`  and ${String(rest)} more; each shows its result below, or in the list of open tasks`]
      : []),
  ];
}

function renderNow(input: BriefInput): string[] {
  const session = input.session;
  const nowMs = input.nowMs;

  if (session.now === null) {
    return ['NOW  none. Run: www now <id> "<next step>"'];
  }

  const note = input.notes.find((candidate) => candidate.id === session.now);

  const setAge =
    session.nowSet === null ? '' : ` · set ${formatAge(nowMs - Date.parse(session.nowSet))} ago`;

  return [
    `NOW  ${session.now}${setAge}${formatNoteAge(note, nowMs)}`,
    ...(session.nowNext === null ? [] : [renderNext(input, session.now, session.nowNext)]),
    ...(note === undefined ? [] : wrapBlock(note.note, '    ', '    ')),
  ];
}

function formatNoteAge(note: Note | undefined, nowMs: number): string {
  if (note === undefined) {
    return '';
  }

  return ` · ${note.owed ? 'owed note' : 'note'} ${formatAge(nowMs - Date.parse(note.written))} ago`;
}

function renderNext(input: BriefInput, id: string, next: string): string {
  const fix = `Run: www now ${id} "<next step>"`;

  return match(input.nowHidden)
    .with(null, () => `  next: ${next}`)
    .with({ kind: 'changed' }, () => `  next step hidden: ${id} changed after it was set. ${fix}`)
    .with({ kind: 'reads' }, (reads) => `  next step hidden: ${id} reads ${reads.result}. ${fix}`)
    .exhaustive();
}
