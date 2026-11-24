import { getSessionDay } from '../brief/get-session-day.ts';
import { findExtraValue } from '../rules/find-extra-value.ts';
import type { JournalRow } from '../types.ts';

const minIDWidth = 11;
const minOpWidth = 10;
const minWhoWidth = 7;

export function renderLog(unsorted: readonly JournalRow[], started: string): string {
  if (unsorted.length === 0) {
    return 'No journal rows match.\n';
  }

  const rows = unsorted.toSorted((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const days = rows.map((row) => `day ${String(getSessionDay(started, Date.parse(row.ts)))}`);
  const dayWidth = days.reduce((widest, day) => Math.max(widest, day.length), 0);
  const whos = rows.map((row) => getWho(row));

  const opWidth = getColumnWidth(
    minOpWidth,
    rows.map((row) => row.op),
  );

  const idWidth = getColumnWidth(
    minIDWidth,
    rows.map((row) => row.id),
  );

  const whoWidth = getColumnWidth(minWhoWidth, whos);

  const lines = rows.flatMap((row, index) => {
    const day = (days[index] ?? '').padEnd(dayWidth);
    const who = whos[index] ?? '';
    const prefix = `${day}  ${row.ts.slice(11, 16)}  ${row.op.padEnd(opWidth)}${row.id.padEnd(idWidth)}${who.padEnd(whoWidth)}`;
    const text = formatText(row);
    const line = text === '' ? prefix.trimEnd() : `${prefix}${text}`;

    return row.why === null ? [line] : [line, `${' '.repeat(prefix.length)}why: ${row.why}`];
  });

  return `${lines.join('\n')}\n`;
}

function getWho(row: JournalRow): string {
  const isDecision = row.op === 'decide' || row.op === 'ruled-out';

  return (isDecision ? findExtraValue(row.extra, 'who') : null) ?? row.by;
}

// a column is as wide as its minimum, or as its longest value plus one space
function getColumnWidth(minimum: number, values: readonly string[]): number {
  return values.reduce((widest, value) => Math.max(widest, value.length + 1), minimum);
}

function formatText(row: JournalRow): string {
  if (row.op !== 'note') {
    return row.text ?? '';
  }

  if (findExtraValue(row.extra, 'cleared') === '1') {
    return 'note cleared';
  }

  return findExtraValue(row.extra, 'owed') === '1' ? `owed: ${row.text ?? ''}` : (row.text ?? '');
}
