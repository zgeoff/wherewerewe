import type { Extra, Item, Kind } from '../types.ts';
import { itemsHeader } from './constants.ts';

export type ItemsParse =
  | { readonly kind: 'items'; readonly items: Item[] }
  | { readonly kind: 'broken'; readonly line: number; readonly reason: string };

export function parseItemsFile(text: string): ItemsParse {
  const lines = text.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  if (lines[0] !== itemsHeader) {
    return { kind: 'broken', line: 1, reason: 'the header row is missing or changed' };
  }

  const items: Item[] = [];

  for (const [index, line] of lines.slice(1).entries()) {
    const parsed = parseItemLine(line);

    if (typeof parsed === 'string') {
      return { kind: 'broken', line: index + 2, reason: parsed };
    }

    items.push(parsed);
  }

  return { kind: 'items', items };
}

function parseItemLine(line: string): Item | string {
  const cells = line.split('\t');
  const [id, kind, claim, check, atWrite, last, written, by, extraCell] = cells;

  if (
    cells.length !== 9 ||
    id === undefined ||
    kind === undefined ||
    claim === undefined ||
    check === undefined ||
    atWrite === undefined ||
    last === undefined ||
    written === undefined ||
    by === undefined ||
    extraCell === undefined
  ) {
    return `expected 9 tab-separated columns, found ${String(cells.length)}`;
  }

  if (!isKind(kind)) {
    return `the kind "${kind}" is not task, wait, ok, rule or where`;
  }

  if (!isAuthor(by)) {
    return `the author "${by}" is not agent, owner or import`;
  }

  const extra = parseExtra(extraCell);

  if (typeof extra === 'string') {
    return extra;
  }

  return {
    id,
    kind,
    claim,
    check: toNullable(check),
    atWrite: toNullable(atWrite),
    last: toNullable(last),
    written,
    by,
    extra,
  };
}

const kinds: ReadonlySet<string> = new Set(['task', 'wait', 'ok', 'rule', 'where']);

function isKind(value: string): value is Kind {
  return kinds.has(value);
}

const authors: ReadonlySet<string> = new Set(['agent', 'owner', 'import']);

function isAuthor(value: string): value is Item['by'] {
  return authors.has(value);
}

const extraKeys: ReadonlySet<string> = new Set([
  'who',
  'where',
  'scope',
  'use',
  'blocked_by',
  'pid_start',
]);

function parseExtra(cell: string): Extra | string {
  if (cell === '-') {
    return {};
  }

  const pairs: Record<string, string> = {};

  for (const pair of cell.split(';')) {
    const split = pair.indexOf('=');
    const key = pair.slice(0, split);

    if (split < 1 || !extraKeys.has(key)) {
      return `the extra "${pair}" is not a known key=value pair`;
    }

    pairs[key] = pair.slice(split + 1);
  }

  const use = pairs['use'];

  if (use !== undefined && use !== 'once' && use !== 'standing') {
    return `the use "${use}" is not once or standing`;
  }

  return {
    ...(pairs['who'] === undefined ? {} : { who: pairs['who'] }),
    ...(pairs['where'] === undefined ? {} : { where: pairs['where'] }),
    ...(pairs['scope'] === undefined ? {} : { scope: pairs['scope'] }),
    ...(use === undefined ? {} : { use }),
    ...(pairs['blocked_by'] === undefined ? {} : { blocked_by: pairs['blocked_by'] }),
    ...(pairs['pid_start'] === undefined ? {} : { pid_start: pairs['pid_start'] }),
  };
}

function toNullable(cell: string): string | null {
  return cell === '-' ? null : cell;
}
