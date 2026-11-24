import type { GrantWords } from '../rules/count-grant-words.ts';
import { renderGrantBullets } from './render-grant-bullets.ts';

// The lines the grant's bullets take in the brief, counted by the renderer that prints them. A
// change to how the renderer wraps changes what the line limit allows, so the worst-case brief test
// guards a grant at the limit.
export function countGrantLines(words: GrantWords): number {
  return renderGrantBullets(words).length;
}
