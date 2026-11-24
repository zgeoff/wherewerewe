import { isUTCTime } from '../rules/is-utc-time.ts';
import type { PullRequestRow } from '../types.ts';
import { prsHeader } from './constants.ts';

export type PrsParse =
  | { readonly kind: 'prs'; readonly prs: readonly PullRequestRow[] }
  | {
      readonly kind: 'broken';

      // the first row that does not parse
      readonly line: number;
      readonly reason: string;

      // the rows that do parse
      readonly prs: readonly PullRequestRow[];
    };

export function parsePrsFile(text: string): PrsParse {
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  if (lines[0] !== prsHeader) {
    return { kind: 'broken', line: 1, reason: 'the header row is missing or changed', prs: [] };
  }

  const prs: PullRequestRow[] = [];
  let firstBroken: { readonly line: number; readonly reason: string } | null = null;

  for (const [index, line] of lines.slice(1).entries()) {
    const parsed = parsePrsLine(line);

    if (typeof parsed === 'string') {
      firstBroken ??= { line: index + 2, reason: parsed };
    } else if (prs.some((row) => row.ref === parsed.ref)) {
      firstBroken ??= { line: index + 2, reason: 'the ref repeats an earlier row' };
    } else {
      prs.push(parsed);
    }
  }

  return firstBroken === null
    ? { kind: 'prs', prs }
    : { kind: 'broken', line: firstBroken.line, reason: firstBroken.reason, prs };
}

function parsePrsLine(line: string): PullRequestRow | string {
  const cells = line.split('\t');
  const [ref, opened, state, seen] = cells;

  if (
    cells.length !== 4 ||
    ref === undefined ||
    opened === undefined ||
    state === undefined ||
    seen === undefined
  ) {
    return `expected 4 tab-separated columns, found ${String(cells.length)}`;
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9][0-9]*$/u.test(ref)) {
    return 'the ref is not <owner>/<repo>#<n>';
  }

  if (!isUTCTime(opened)) {
    return 'the opened time is not an ISO 8601 UTC time to the second, ending in Z';
  }

  if (state !== '-' && state !== 'OPEN' && state !== 'MERGED' && state !== 'CLOSED') {
    return 'the state is not OPEN, MERGED, CLOSED or -';
  }

  if (seen !== '-' && !isUTCTime(seen)) {
    return 'the seen is not - or an ISO 8601 UTC time to the second, ending in Z';
  }

  return { ref, opened, state: state === '-' ? null : state, seen: seen === '-' ? null : seen };
}
