import type { Extra, Item } from '../types.ts';
import { itemsHeader } from './constants.ts';

export function formatItemsFile(items: readonly Item[]): string {
  const rows = items.map((item) =>
    [
      item.id,
      item.kind,
      item.claim,
      item.check ?? '-',
      item.atWrite ?? '-',
      item.last ?? '-',
      item.written,
      item.by,
      formatExtra(item.extra),
    ].join('\t'),
  );

  return `${[itemsHeader, ...rows].join('\n')}\n`;
}

function formatExtra(extra: Extra): string {
  const pairs = [
    ['who', extra.who],
    ['where', extra.where],
    ['scope', extra.scope],
    ['blocked_by', extra.blocked_by],
    ['pid_start', extra.pid_start],
  ].flatMap(([key, value]) => (value === undefined ? [] : [`${key ?? ''}=${value}`]));

  return pairs.length === 0 ? '-' : pairs.join(';');
}
