import type { Item } from '../types.ts';

// The command that fixes a changed row, from the table in the design.
export function pickFixCommand(item: Item, result: string): string {
  const check = item.check ?? '';

  if (result === 'MERGED') {
    return `www done ${item.id} --evidence "merged, seen by check"`;
  }

  if (result === 'CLOSED') {
    return `www drop ${item.id} --why "closed unmerged, seen by check"`;
  }

  if (result === 'gone' && check.startsWith('pid:')) {
    return `www drop ${item.id} --why "process gone, seen by check"`;
  }

  if (result === 'gone' && check.startsWith('branch:')) {
    return `www drop ${item.id} --why "branch gone, seen by check"`;
  }

  if (result === 'missing' && check.startsWith('path:')) {
    return `www drop ${item.id} --why "path missing, seen by check"`;
  }

  return `www set ${item.id} "<what is true now>"`;
}
