import { collectChangedIDs } from '../brief/collect-changed-ids.ts';
import { formatAge } from '../brief/format-age.ts';
import { formatTaskLine } from '../brief/format-task-line.ts';
import { orderTasks } from '../brief/order-tasks.ts';
import { wrapBlock } from '../brief/wrap-block.ts';
import type { Item, Note } from '../types.ts';

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
    const row = formatTaskLine(task, input.items, input.notes, input.nowMs);

    if (note === undefined) {
      return [row];
    }

    const age = formatAge(input.nowMs - Date.parse(note.written));

    return [
      row,
      ...wrapBlock(note.note, `    ${note.owed ? 'owed note' : 'note'} (${age}): `, '    '),
    ];
  });

  return `${[`OPEN (${String(tasks.length)} of 30)`, ...lines].join('\n')}\n`;
}
