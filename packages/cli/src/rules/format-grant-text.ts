import type { GrantWords } from './count-grant-words.ts';

// The grant's words as one journal cell: each group that has bullets, as its label and its bullets
// joined by " • ", then the scope, the parts joined by " · ".
export function formatGrantText(words: GrantWords): string {
  const groups = [
    { label: 'may', bullets: words.may },
    { label: 'not', bullets: words.not },
    { label: 'never', bullets: words.never },
  ];

  return [
    ...groups
      .filter((group) => group.bullets.length > 0)
      .map((group) => `${group.label}: ${group.bullets.join(' • ')}`),
    ...(words.scope === null ? [] : [`scope: ${words.scope}`]),
  ].join(' · ');
}
