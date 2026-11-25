import { collectChangedIDs } from '../brief/collect-changed-ids.ts';
import { formatTaskLine } from '../brief/format-task-line.ts';
import { orderTasks } from '../brief/order-tasks.ts';
import { itemCaps } from '../rules/item-caps.ts';
import type { Item, Note } from '../types.ts';
import { formatNoteLines } from './format-note-lines.ts';

// Every open task in the brief's order, each row as the brief prints it and its note whole. No
// line is cut.
export interface TaskListInput {
  readonly items: readonly Item[];
  readonly notes: readonly Note[];
  readonly focus: string | null;
  readonly nowMs: number;
}

export function renderTaskList(input: TaskListInput): string {
  const tasks = orderTasks({
    items: input.items,
    notes: input.notes,
    focus: input.focus,
    changedIDs: collectChangedIDs(input.items, []),
  });

  const lines = tasks.flatMap((task) => {
    const note = input.notes.find((candidate) => candidate.id === task.id);

    const row = formatTaskLine(task, {
      items: input.items,
      notes: input.notes,
      nowMs: input.nowMs,
      results: new Map(),
    });

    if (note === undefined) {
      return [row];
    }

    return [row, ...formatNoteLines(note, input.nowMs)];
  });

  return `${[`OPEN (${String(tasks.length)}, max ${String(itemCaps.task)})`, ...lines].join('\n')}\n`;
}
