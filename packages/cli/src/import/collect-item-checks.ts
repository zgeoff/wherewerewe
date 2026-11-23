import { canBlock } from '../rules/can-block.ts';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { parseCheckRef } from '../rules/parse-check-ref.ts';
import { itemsHeader } from '../store/constants.ts';
import type { Extra, Item, Kind } from '../types.ts';
import { checkHeader } from './check-header.ts';
import { carriageReturnProblem, idRuleProblem } from './constants.ts';
import type { HandKeptRow, HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts, ItemChecks } from './types.ts';

export function collectItemChecks(hand: HandKeptStore, facts: Facts): ItemChecks {
  const headerProblems = checkHeader(
    'items.tsv',
    hand.items.header,
    itemsHeader,
    'id, kind, claim, check, at_write, last, written, by, extra',
  );

  const openRows = facts.itemRows.filter((row) => !facts.settledIDs.has(row.cells[0] ?? ''));

  const blockers = new Map<string, Kind>();
  const openIDs = new Map<string, number>();

  for (const row of openRows) {
    const id = stripCarriageReturn(row.cells[0] ?? '');
    const kind = stripCarriageReturn(row.cells[1] ?? '');

    if (isKind(kind)) {
      blockers.set(id, kind);
    }

    if (!openIDs.has(id)) {
      openIDs.set(id, row.line);
    }
  }

  for (const question of facts.questions) {
    blockers.set(question.id, 'wait');
  }

  const items: Item[] = [];
  const lines: { readonly line: number; readonly text: string }[] = [];

  for (const row of hand.items.rows) {
    if (row.cells.length !== 9) {
      lines.push({
        line: row.line,
        text: `items.tsv line ${String(row.line)}: the row has ${String(row.cells.length)} columns, and items.tsv has 9.`,
      });
    } else if (!facts.settledIDs.has(row.cells[0] ?? '')) {
      const checked = checkItemRow(row, openIDs, blockers);

      if (checked.item !== null) {
        items.push(checked.item);
      }

      if (checked.problems.length > 0) {
        lines.push({
          line: row.line,
          text: `items.tsv line ${String(row.line)} (${checked.id}): ${checked.problems.join('; ')}`,
        });
      }
    }
  }

  return {
    items,
    problems: [...headerProblems, ...lines.map((entry) => entry.text)],
    openKinds: new Map(
      openRows.flatMap((row): [string, Kind][] => {
        const kind = stripCarriageReturn(row.cells[1] ?? '');

        return isKind(kind) ? [[stripCarriageReturn(row.cells[0] ?? ''), kind]] : [];
      }),
    ),
    openIDs,
  };
}

const kinds: readonly Kind[] = ['task', 'wait', 'ok', 'rule', 'where'];

function isKind(value: string): value is Kind {
  return kinds.some((kind) => kind === value);
}

interface ItemCheck {
  readonly id: string;
  readonly item: Item | null;
  readonly problems: readonly string[];
}

const extraLimits = { who: 16, where: 16, scope: 40 } as const;

function checkItemRow(
  row: HandKeptRow,
  openIDs: ReadonlyMap<string, number>,
  blockers: ReadonlyMap<string, Kind>,
): ItemCheck {
  const hasCarriageReturn = row.cells.some((cell) => cell.includes('\r'));
  const cells = row.cells.map((cell) => stripCarriageReturn(cell));
  const [id = '', kind = '', claim = '', check = '', atWrite = '', last = '', written = ''] = cells;
  const by = cells[7] ?? '';
  const extraCell = cells[8] ?? '';
  const parsedExtra = parseExtraCell(extraCell);
  const firstLine = openIDs.get(id);
  const extra = parsedExtra.extra;
  const parsedCheck = check === '-' ? null : parseCheckRef(check);
  const claimProblem = findTextProblem(claim, 120);
  const label = kind === 'ok' ? 'quote' : 'claim';

  const credential = [claim, extra.who, extra.where, extra.scope].flatMap((text) => {
    const found = text === undefined ? null : findCredentialMatch(text);

    return found === null ? [] : [`the text looks like a credential (it matches ${found}).`];
  });

  const limitProblems = (['who', 'where', 'scope'] as const).flatMap((key) => {
    const value = extra[key];
    const problem = value === undefined ? null : findTextProblem(value, extraLimits[key]);

    if (problem?.kind === 'empty') {
      return [`the ${key} is empty.`];
    }

    return problem?.kind === 'too-long'
      ? [
          `the ${key} is ${String(problem.length)} characters, and the limit is ${String(extraLimits[key])}.`,
        ]
      : [];
  });

  const problems = [
    ...(isItemID(id) ? [] : [idRuleProblem]),
    ...(firstLine !== undefined && firstLine !== row.line
      ? [`line ${String(firstLine)} has the same id.`]
      : []),
    ...(isKind(kind) ? [] : [`the kind ${kind} is not task, wait, ok, rule or where.`]),
    ...(check !== '-' && parsedCheck === null ? [`the check ${check} does not parse.`] : []),
    ...(kind === 'rule' && check !== '-' ? ['a rule has no check.'] : []),
    ...(by === 'agent' || by === 'owner' || by === 'import'
      ? []
      : [`by is ${by}, and it must be agent, owner or import.`]),
    ...(claimProblem?.kind === 'empty' ? [`the ${label} is empty.`] : []),
    ...(claimProblem?.kind === 'too-long'
      ? [`the ${label} is ${String(claimProblem.length)} characters, and the limit is 120.`]
      : []),
    ...limitProblems,
    ...parsedExtra.problems,
    ...(kind === 'ok' &&
    (!parsedExtra.keys.has('who') ||
      !parsedExtra.keys.has('where') ||
      !parsedExtra.keys.has('scope') ||
      !parsedExtra.keys.has('use'))
      ? ['an approval needs who, where, scope, and once or standing.']
      : []),
    ...(kind === 'wait' && extra.who === undefined ? ['a wait needs who.'] : []),
    ...(extra.blocked_by !== undefined && !isBlocker(blockers, extra.blocked_by)
      ? [`blocked_by=${extra.blocked_by} names no open task or wait.`]
      : []),
    ...credential,
    ...(hasCarriageReturn ? [carriageReturnProblem] : []),
  ];

  const item: Item | null =
    isKind(kind) && (by === 'agent' || by === 'owner' || by === 'import')
      ? {
          id,
          kind,
          claim,
          check: check === '-' ? null : check,
          atWrite: atWrite === '-' ? null : atWrite,
          last: last === '-' ? null : last,
          written,
          by,
          extra,
        }
      : null;

  return { id, item, problems };
}

const extraKeys = ['who', 'where', 'scope', 'use', 'blocked_by', 'pid_start'] as const;

type ExtraKey = (typeof extraKeys)[number];

interface ExtraParse {
  readonly extra: Extra;

  // the keys the cell names, valid or not
  readonly keys: ReadonlySet<ExtraKey>;
  readonly problems: readonly string[];
}

function parseExtraCell(cell: string): ExtraParse {
  if (cell === '-') {
    return { extra: {}, keys: new Set(), problems: [] };
  }

  const pairs = new Map<ExtraKey, string>();

  const equals: string[] = [];
  const tokens: string[] = [];
  const unknownKeys: string[] = [];
  const useProblems: string[] = [];

  for (const token of cell.split(';')) {
    const split = token.indexOf('=');
    const key = token === 'once' || token === 'standing' ? 'use' : token.slice(0, split);
    const value = token === 'once' || token === 'standing' ? token : token.slice(split + 1);

    if (token !== 'once' && token !== 'standing' && split < 1) {
      tokens.push(`the extra token "${cutToken(token)}" is not key=value, once or standing.`);
    } else if (value.includes('=')) {
      equals.push(`the ${key} holds "=", and an extra value never holds ; or =.`);
    } else if (!isExtraKey(key)) {
      unknownKeys.push(
        `the extra key ${key} is not who, where, scope, use, blocked_by or pid_start.`,
      );
    } else if (pairs.has(key)) {
      useProblems.push(`the extra key ${key} is given twice.`);
    } else {
      pairs.set(key, value);

      if (key === 'use' && value !== 'once' && value !== 'standing') {
        useProblems.push(`the use ${value} is not once or standing.`);
      }
    }
  }

  const use = pairs.get('use');

  return {
    keys: new Set(pairs.keys()),
    extra: {
      ...(pairs.has('who') ? { who: pairs.get('who') ?? '' } : {}),
      ...(pairs.has('where') ? { where: pairs.get('where') ?? '' } : {}),
      ...(pairs.has('scope') ? { scope: pairs.get('scope') ?? '' } : {}),
      ...(use === 'once' || use === 'standing' ? { use } : {}),
      ...(pairs.has('blocked_by') ? { blocked_by: pairs.get('blocked_by') ?? '' } : {}),
      ...(pairs.has('pid_start') ? { pid_start: pairs.get('pid_start') ?? '' } : {}),
    },
    problems: [...equals, ...tokens, ...unknownKeys, ...useProblems],
  };
}

function cutToken(token: string): string {
  const points = [...token];

  return points.length > 40 ? `${points.slice(0, 40).join('')}…` : token;
}

function isExtraKey(value: string): value is ExtraKey {
  return extraKeys.some((key) => key === value);
}

function isBlocker(blockers: ReadonlyMap<string, Kind>, id: string): boolean {
  const kind = blockers.get(id);

  return kind !== undefined && canBlock(kind);
}
