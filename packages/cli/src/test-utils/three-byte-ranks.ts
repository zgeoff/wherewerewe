import type { CutRank } from '../brief/cut-ranks.ts';

// Each rank's rows in the 3-byte worst case: the caps give how many a whole brief holds, and the
// id prefix names a row of that rank.
export const threeByteRanks: Readonly<
  Record<CutRank, { readonly prefix: RegExp; readonly cap: number }>
> = {
  'pull-requests': { prefix: /^ {2}p{60}/u, cap: 1 },
  promises: { prefix: /^ {2}prom\d\d/u, cap: 5 },
  where: { prefix: /^ {2}here\d\d/u, cap: 8 },
  tasks: { prefix: /^ {2}task\d\d/u, cap: 29 },
  'waits-on-others': { prefix: /^ {2}wait\d\d/u, cap: 8 },
  decisions: { prefix: /^ {2}d-\d\d/u, cap: 3 },
  lessons: { prefix: /^ {2}less\d\d/u, cap: 5 },
  rules: { prefix: /^ {2}rule\d\d/u, cap: 15 },
  approval: { prefix: /^ {2}appr\d\d/u, cap: 1 },
  'waits-on-owner': { prefix: /^ {2}nowait/u, cap: 0 },
  words: { prefix: /^ {2}word\d\d/u, cap: 8 },
};
