// brief.md, The cut order: the rows the cut drops, first to go first, from rank 12 down to rank 2.
// Every other line is never cut. A test pins this list against the table of that doc.
export const cutRanks = [
  'pull-requests',
  'promises',
  'where',
  'tasks',
  'waits-on-others',
  'decisions',
  'lessons',
  'rules',
  'approval',
  'waits-on-owner',
  'words',
] as const;

export type CutRank = (typeof cutRanks)[number];
