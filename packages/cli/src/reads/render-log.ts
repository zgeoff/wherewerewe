import { getSessionDay } from '../brief/get-session-day.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

const idWidth = 11;
const opWidth = 10;
const whoWidth = 7;

// The rows as one line each, oldest first: the day, the time, the op, the id, who, and the text,
// with the why on a line of its own under it. Who is the who= of a decision, otherwise the author.
export function renderLog(rows: readonly JournalRow[], started: string): string {
  if (rows.length === 0) {
    return 'No journal rows match.\n';
  }

  const days = rows.map((row) => `day ${String(getSessionDay(started, Date.parse(row.ts)))}`);
  const dayWidth = Math.max(...days.map((day) => day.length));

  const lines = rows.flatMap((row, index) => {
    const day = (days[index] ?? '').padEnd(dayWidth);
    const id = row.id.length >= idWidth ? `${row.id} ` : row.id.padEnd(idWidth);
    const who = getWho(row);
    const prefix = `${day}  ${row.ts.slice(11, 16)}  ${row.op.padEnd(opWidth)}${id}${who.padEnd(whoWidth)}`;
    const line = `${prefix}${row.text ?? ''}`.trimEnd();

    return row.why === null ? [line] : [line, `${' '.repeat(prefix.length)}why: ${row.why}`];
  });

  return `${lines.join('\n')}\n`;
}

function getWho(row: JournalRow): string {
  const isDecision = row.op === 'decide' || row.op === 'ruled-out';

  return (isDecision ? findExtraValue(row.extra, 'who') : null) ?? row.by;
}
