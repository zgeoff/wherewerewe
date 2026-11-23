import { formatAge } from '../brief/format-age.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import type { SessionSummary } from '../types.ts';

// One line per session, with the names padded to the longest, or the line that says there is none.
// The format comes first: a newer store has no other field read, and still says what it is.
export function formatSessionLines(summaries: readonly SessionSummary[], nowMs: number): string {
  if (summaries.length === 0) {
    return 'No sessions on this machine yet. Run: www init <name> --goal "<what done means>"';
  }

  const width = Math.max(...summaries.map((summary) => summary.name.length));

  return summaries.map((summary) => formatSummaryLine(summary, width, nowMs)).join('\n');
}

function formatSummaryLine(summary: SessionSummary, width: number, nowMs: number): string {
  const name = summary.name.padEnd(width);

  if (summary.format === '0-by-hand') {
    return `  ${name}  hand-kept: run www import ${summary.name}`;
  }

  if (summary.format !== null && summary.format !== '1') {
    return `  ${name}  format ${summary.format}: this www reads format 1`;
  }

  if (summary.format === null || summary.started === null || summary.goal === null) {
    return `  ${name}  unreadable session file`;
  }

  const lastWrite =
    summary.lastWrite === null
      ? 'last write never'
      : `last write ${formatAge(nowMs - Date.parse(summary.lastWrite))} ago`;

  const goalChars = Array.from(summary.goal, (character) => character);
  const goal = goalChars.length > 60 ? `${goalChars.slice(0, 60).join('')}…` : summary.goal;

  return `  ${name}  day ${String(getSessionDay(summary.started, nowMs))}  ${lastWrite}  ${goal}`;
}
