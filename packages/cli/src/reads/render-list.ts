import { buildItemSections } from '../brief/build-item-sections.ts';
import { formatItemLine } from '../brief/format-item-line.ts';
import { formatPullRequestRow } from '../brief/format-pull-request-row.ts';
import type { BriefInput, ItemSection } from '../brief/types.ts';
import type { ListKind } from '../rules/list-kinds.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Item, Note } from '../types.ts';
import { formatNoteLines } from './format-note-lines.ts';
import { renderTaskList } from './render-task-list.ts';

// Every open row of one kind, whole, as the brief prints it, with each item's note under its row.
// It cuts no row and no line, and a stored value redacts before it wraps.
export function renderList(kind: ListKind, input: BriefInput): string {
  const lines = match(kind, input);

  return lines.length === 0 ? '' : `${lines.map((line) => redactCredential(line)).join('\n')}\n`;
}

function match(kind: ListKind, input: BriefInput): string[] {
  if (kind === 'tasks') {
    return renderTaskList({
      items: input.items,
      notes: input.notes,
      focus: input.session.now,
      nowMs: input.nowMs,
    })
      .trimEnd()
      .split('\n');
  }

  if (kind === 'notes') {
    return collectNoteLines(input);
  }

  if (kind === 'decisions') {
    return [
      `DECISIONS (${String(input.decisions.length)} in force)`,
      ...input.decisions.map((row) => `  ${row.id}  ${row.choice}`),
    ];
  }

  if (kind === 'prs') {
    return [
      `PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (${String(input.pullRequests.length)})`,
      ...input.pullRequests.map((row) => formatPullRequestRow(row, input.nowMs)),
    ];
  }

  return collectSectionLines(kind, input);
}

// Every open item's note, owed first, then the newest `written`, a tie in notes.tsv order, each as
// its item line with no tag, with no heading.
function collectNoteLines(input: BriefInput): string[] {
  const entries = input.notes.flatMap((note, row) => {
    const item = input.items.find((candidate) => candidate.id === note.id);

    return item === undefined ? [] : [{ item, note, row }];
  });

  return entries
    .toSorted(
      (first, second) =>
        Number(second.note.owed) - Number(first.note.owed) ||
        Date.parse(second.note.written) - Date.parse(first.note.written) ||
        first.row - second.row,
    )
    .flatMap((entry) => formatNoteEntry(entry.item, entry.note, input.nowMs));
}

function formatNoteEntry(item: Item, note: Note, nowMs: number): string[] {
  return [formatItemLine(item, null), ...formatNoteLines(note, nowMs)];
}

function collectSectionLines(
  kind: Exclude<ListKind, 'tasks' | 'notes' | 'decisions' | 'prs'>,
  input: BriefInput,
): string[] {
  const section = buildItemSections(input, []).find(
    (candidate): candidate is ItemSection => candidate.cutKind === kind,
  );

  if (section === undefined) {
    return [];
  }

  const lines = [section.heading];

  for (const line of section.lines) {
    const note = input.notes.find((candidate) => candidate.id === line.id);

    lines.push(line.text);

    if (note !== undefined) {
      lines.push(...formatNoteLines(note, input.nowMs));
    }
  }

  return lines;
}
