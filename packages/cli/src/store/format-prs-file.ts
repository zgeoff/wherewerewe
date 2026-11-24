import type { PullRequestRow } from '../types.ts';
import { prsHeader } from './constants.ts';

export function formatPrsFile(prs: readonly PullRequestRow[]): string {
  const rows = prs.map((row) =>
    [row.ref, row.opened, row.state ?? '-', row.seen ?? '-'].join('\t'),
  );

  return `${[prsHeader, ...rows].join('\n')}\n`;
}
