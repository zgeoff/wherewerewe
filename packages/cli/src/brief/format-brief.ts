import type { Row, Rows } from '../types.ts';

const budget = 24_000;

// The brief: every open row, grouped by label. Long labels show their newest rows and a count.
export function formatBrief(name: string, store: Rows, now: number): string {
  for (const keep of [12, 5, 2]) {
    const text = format(name, store, now, keep);

    if (text.length <= budget) {
      return text;
    }
  }

  return format(name, store, now, 1);
}

// These labels print first, in this order, and the brief never shortens them.
const firstLabels = ['goal', 'pin', 'grant', 'now', 'wait'];

function format(name: string, store: Rows, now: number, keep: number): string {
  const open = store.rows.filter((row) => row.closed === undefined);
  const labels = [...new Set([...firstLabels, ...open.map((row) => row.label)])];
  const last = store.lines.at(-1)?.at;
  const skipped = store.unreadable === 0 ? '' : ` · ${store.unreadable} unreadable lines skipped`;
  const head = `${name} · ${open.length} open rows · last write ${last === undefined ? 'never' : formatAge(last, now)}${skipped}`;

  const sections = labels
    .map((label) => ({ label, rows: open.filter((row) => row.label === label) }))
    .filter((section) => section.rows.length > 0)
    .map((section) => formatSection(section.label, section.rows, keep));

  const hints = [
    ...(open.some((row) => row.label === 'goal')
      ? []
      : ['GOAL   none. Run: www goal "<what done means>"']),
    ...(open.some((row) => row.label === 'now')
      ? []
      : ['NOW    none. Run: www now "<your next step>"']),
  ];

  const foot = 'Everything: www rows | jq   ·   Write: www <label> "<text>"   ·   www help';

  return `${[head, ...sections, ...hints, foot].join('\n')}\n`;
}

function formatAge(from: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(from)) / 60_000));

  if (Number.isNaN(minutes)) {
    return 'unknown';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return minutes < 2880 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`;
}

function formatSection(label: string, rows: readonly Row[], keep: number): string {
  // the newest rows by their last write, shown in the order they were first written
  const newest = new Set(
    rows.toSorted((first, second) => (first.at < second.at ? -1 : 1)).slice(-keep),
  );

  const shown = firstLabels.includes(label) ? rows : rows.filter((row) => newest.has(row));
  const single = label === 'goal' || label === 'pin' || label === 'now';
  const count = shown.length < rows.length ? ` (${rows.length}, newest ${shown.length} shown)` : '';
  const name = label.toUpperCase();

  if (single || (shown.length === 1 && count === '' && name.length <= 5)) {
    return shown.map((row) => `${name.padEnd(6)} ${formatRow(row, !single)}`).join('\n');
  }

  const body = shown.map((row) => `       ${formatRow(row, true)}`).join('\n');

  return `${name}${count}\n${body}`;
}

const width = 100;
const noteRoom = 160;

function formatRow(row: Row, withID: boolean): string {
  const lead = withID ? `${row.id}  ` : '';
  const indent = ' '.repeat(7 + lead.length);
  const who = row.who === undefined ? '' : ` [${row.who}]`;

  // the brief shows the start of a note, and `www rows` holds the whole of it
  const first = row.note?.split('\n')[0]?.slice(0, noteRoom);
  const more = row.note !== undefined && row.note !== first ? ' …' : '';

  const note =
    first === undefined
      ? ''
      : `\n${indent}note: ${wrap(first, `${indent}      `, width - indent.length - 6)}${more}`;

  return `${lead}${wrap(`${row.text}${who}`, indent, width - indent.length)}${note}`;
}

function wrap(text: string, indent: string, room: number): string {
  const lines: string[] = [];
  let line = '';

  for (const word of text.split(/\s+/u)) {
    if (line !== '' && line.length + word.length + 1 > room) {
      lines.push(line);

      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }

  lines.push(line);

  return lines.join(`\n${indent}`);
}
