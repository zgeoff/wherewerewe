import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import type { OwnerNote } from '../types.ts';
import { ownerHeader } from './constants.ts';

const noteCap = 2;

export type OwnerParse =
  | { readonly kind: 'notes'; readonly notes: readonly OwnerNote[] }
  | {
      readonly kind: 'broken';

      // the first row that does not parse
      readonly line: number;
      readonly reason: string;

      // the rows that do parse, which a read prints and say and ack never use
      readonly notes: readonly OwnerNote[];
    };

export function parseOwnerFile(text: string): OwnerParse {
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  if (lines[0] !== ownerHeader) {
    return { kind: 'broken', line: 1, reason: 'the header row is missing or changed', notes: [] };
  }

  const notes: OwnerNote[] = [];
  let firstBroken: { readonly line: number; readonly reason: string } | null = null;

  for (const [index, line] of lines.slice(1).entries()) {
    const parsed = parseOwnerLine(line);

    if (typeof parsed === 'string') {
      firstBroken ??= { line: index + 2, reason: parsed };
    } else if (notes.some((note) => note.id === parsed.id)) {
      firstBroken ??= { line: index + 2, reason: 'the id repeats an earlier row' };
    } else if (notes.length >= noteCap) {
      firstBroken ??= { line: index + 2, reason: `more than ${String(noteCap)} notes` };
    } else {
      notes.push(parsed);
    }
  }

  return firstBroken === null
    ? { kind: 'notes', notes }
    : { kind: 'broken', line: firstBroken.line, reason: firstBroken.reason, notes };
}

const saidFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function parseOwnerLine(line: string): OwnerNote | string {
  const cells = line.split('\t');
  const [id, text, said, on] = cells;

  if (
    cells.length !== 4 ||
    id === undefined ||
    text === undefined ||
    said === undefined ||
    on === undefined
  ) {
    return `expected 4 tab-separated columns, found ${String(cells.length)}`;
  }

  if (!/^o-[1-9][0-9]*$/u.test(id) || !Number.isSafeInteger(Number(id.slice('o-'.length)))) {
    return 'the id is not o-<n>';
  }

  if (findTextProblem(text, 160) !== null) {
    return 'the text is empty, longer than 160 characters or not one line';
  }

  if (!saidFormat.test(said) || !isRealTime(said)) {
    return 'the said time is not an ISO 8601 UTC time to the second, ending in Z';
  }

  if (on !== '-' && !isItemID(on)) {
    return 'the on is not - or an item id';
  }

  return { id, text, said, on: on === '-' ? null : on };
}

// Date.parse rolls an impossible date, such as 02-30, into the next month, so compare the round trip.
function isRealTime(said: string): boolean {
  const parsedAtMs = Date.parse(said);

  return (
    !Number.isNaN(parsedAtMs) && new Date(parsedAtMs).toISOString() === said.replace('Z', '.000Z')
  );
}
