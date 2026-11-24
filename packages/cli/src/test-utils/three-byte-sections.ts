import type { CutRank } from '../brief/cut-ranks.ts';

// The section each rank's rows sit in, and the kind its cut line names.
export const threeByteSections: Readonly<
  Record<CutRank, { readonly heading: string; readonly kind: string | null }>
> = {
  'pull-requests': { heading: 'PULL REQUESTS THIS SESSION', kind: null },
  promises: { heading: 'PROMISED (', kind: 'promises' },
  where: { heading: 'WHERE (', kind: 'where' },
  tasks: { heading: 'OPEN (', kind: null },
  'waits-on-others': { heading: 'WAITING (', kind: 'waits' },
  decisions: { heading: 'DECISIONS (', kind: 'decisions' },
  lessons: { heading: 'LESSONS (', kind: 'lessons' },
  rules: { heading: 'RULES (', kind: 'rules' },
  approval: { heading: 'APPROVED ONCE (', kind: 'approvals' },
  'waits-on-owner': { heading: 'WAITING (', kind: 'waits' },
  words: { heading: 'WORDS (', kind: 'words' },
};
