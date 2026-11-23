import { getSessionDay } from '../brief/get-session-day.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

const idWidth = 11;
const opWidth = 10;
const whoWidth = 7;

export function renderLog(unsorted: readonly JournalRow[], started: string): string {
  if (unsorted.length === 0) {
    return 'No journal rows match.\n';
  }

  const rows = unsorted.toSorted((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const days = rows.map((row) => `day ${String(getSessionDay(started, Date.parse(row.ts)))}`);
  const dayWidth = days.reduce((widest, day) => Math.max(widest, day.length), 0);

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
