import type { GrantWords } from '../rules/count-grant-words.ts';
import { wrapBlock } from './wrap-block.ts';

const groups = [
  { label: 'may', key: 'may', isShared: false },
  { label: 'not', key: 'not', isShared: false },
  { label: 'never', key: 'never', isShared: true },
] as const;

// The grant's bullets under their labels, each group left out when it has none. A never bullet
// joins the line before when that line holds whole never bullets, neither holds a •, and the line
// stays within 100 characters; may and not bullets take a line each.
export function renderGrantBullets(words: GrantWords): string[] {
  return groups.flatMap((group) => renderGroup(group.label, words[group.key], group.isShared));
}

interface GroupLines {
  readonly lines: readonly string[];

  // whether the next bullet may join the last line
  readonly isOpen: boolean;
}

const maxWidth = 100;
const textIndent = ' '.repeat(11);
const bulletIndent = `${' '.repeat(9)}• `;
const gap = '  • ';

function renderGroup(label: string, bullets: readonly string[], isShared: boolean): string[] {
  const rendered = bullets.reduce<GroupLines>(
    (current, bullet, index) => {
      const last = current.lines.at(-1);
      const joined = `${last ?? ''}${gap}${bullet}`;

      if (
        isShared &&
        current.isOpen &&
        last !== undefined &&
        !bullet.includes('•') &&
        countCodePoints(joined) <= maxWidth
      ) {
        return { lines: [...current.lines.slice(0, -1), joined], isOpen: true };
      }

      const first = index === 0 ? `  ${label.padEnd(7)}• ` : bulletIndent;
      const wrapped = wrapBlock(bullet, first, textIndent);

      return {
        lines: [...current.lines, ...wrapped],
        isOpen: wrapped.length === 1 && !bullet.includes('•'),
      };
    },
    { lines: [], isOpen: false },
  );

  return [...rendered.lines];
}

function countCodePoints(text: string): number {
  return Array.from(text, (character) => character).length;
}
