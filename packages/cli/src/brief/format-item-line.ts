import type { Item } from '../types.ts';
import { padID } from './pad-id.ts';

// `  <id>  <claim>  [<tag>]`, with no tag part when the tag is null.
export function formatItemLine(item: Item, tag: string | null): string {
  return `  ${padID(item.id)}${item.claim}${tag === null ? '' : `  [${tag}]`}`;
}

export function withOwed(tag: string, isOwed: boolean): string {
  return isOwed ? `${tag} · owed` : tag;
}
