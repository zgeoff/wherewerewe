import { match } from 'ts-pattern';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import type { Note } from '../types.ts';
import { formatAge } from './format-age.ts';
import { formatGoalLines } from './format-goal-lines.ts';
import { getSessionDay } from './get-session-day.ts';
import { padID } from './pad-id.ts';
import { pickFixCommand } from './pick-fix-command.ts';
import { renderGrantLines } from './render-grant-lines.ts';
import type { BriefInput, ItemSection } from './types.ts';
import { wrapBlock } from './wrap-block.ts';

const footer =
  'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help';

// The brief's text with the sections' kept lines, after the redaction `runCLI` runs on all output,
// so the brief is measured as it prints: a session name that looks like a credential grows.
export function joinBrief(
  input: BriefInput,
  sections: readonly ItemSection[],
  cuts: readonly (readonly boolean[])[],
  cutCount: number,
): string {
  const kept = sections.map((section, index) => {
    const lines = section.lines
      .filter((_line, lineIndex) => cuts[index]?.[lineIndex] !== true)
      .map((line) => line.text);

    return {
      heading: section.heading,
      lines,
      tail: lines.length > 0 && section.tail !== null ? [section.tail] : [],
    };
  });

  const lastKeptIndex = kept.findLastIndex((section) => section.lines.length > 0);
  const itemLines: string[] = [];

  for (const [index, section] of kept.entries()) {
    if (section.lines.length > 0) {
      itemLines.push(section.heading, ...section.lines, ...section.tail);
    }

    if (section.lines.length > 0 && cutCount > 0 && index === lastKeptIndex) {
      itemLines.push(`  (${String(cutCount)} lines cut to fit; run www show <id>)`);
    }
  }

  const lines = [
    ...renderHeader(input),
    ...formatGoalLines(input.session.goal),
    ...renderGrant(input),
    ...renderOwnerNotes(input),
    ...renderChanged(input),
    ...renderNow(input),
    ...itemLines,
    footer,
  ];

  return redactCredentialWords(`${lines.join('\n')}\n`);
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
    ...(session.nowNext === null ? [] : [`  next: ${session.nowNext}`]),
    ...(note === undefined ? [] : wrapBlock(note.note, '    ', '    ')),
  ];
}

function formatNoteAge(note: Note | undefined, nowMs: number): string {
  if (note === undefined) {
    return '';
  }

  return ` · ${note.owed ? 'owed note' : 'note'} ${formatAge(nowMs - Date.parse(note.written))} ago`;
}
