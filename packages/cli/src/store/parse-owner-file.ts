import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import type { OwnerNote } from '../types.ts';
import { ownerHeader } from './constants.ts';

export type OwnerParse =
  | { readonly kind: 'notes'; readonly notes: OwnerNote[] }
  | {
      readonly kind: 'broken';

      // the first row that does not parse
      readonly line: number;
      readonly reason: string;

      // the rows that do parse, which a read prints and say and ack never use
      readonly notes: OwnerNote[];
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
    } else {
      notes.push(parsed);
    }
  }

  return firstBroken === null
    ? { kind: 'notes', notes }
    : { kind: 'broken', line: firstBroken.line, reason: firstBroken.reason, notes };
}

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

  if (!/^o-[1-9][0-9]*$/u.test(id)) {
    return `the id "${id}" is not o-<n>`;
  }

  if (findTextProblem(text, 160) !== null) {
    return 'the text is empty, longer than 160 characters or not one line';
  }

  if (said === '') {
    return 'the said time is empty';
  }

  if (on !== '-' && !isItemID(on)) {
    return `the on "${on}" is not - or an item id`;
  }

  return { id, text, said, on: on === '-' ? null : on };
}
