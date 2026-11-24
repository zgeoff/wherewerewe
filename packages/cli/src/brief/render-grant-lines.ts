import type { Grant } from '../types.ts';
import { formatAge } from './format-age.ts';
import { renderGrantBullets } from './render-grant-bullets.ts';
import { wrapBlock } from './wrap-block.ts';

// The GRANT block as the brief prints it: the heading with where, age and scope, the bullets
// under may, not and never, then the wrapped reading. Every line is at most 100 characters.
export function renderGrantLines(grant: Grant, nowMs: number): string[] {
  const age = formatAge(nowMs - Date.parse(grant.set));
  const scope = grant.scope === null ? '' : ` · ${grant.scope}`;

  return [
    `GRANT  from the owner in ${grant.where}, ${age} ago${scope}`,
    ...renderGrantBullets(grant),
    ...wrapBlock(grant.reading, '  reading: ', '    '),
  ];
}
