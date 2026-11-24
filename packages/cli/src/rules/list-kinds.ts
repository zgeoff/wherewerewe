// What `www list` takes, in the order its help line and refusal print them.
export const listKinds = [
  'tasks',
  'waits',
  'approvals',
  'rules',
  'where',
  'lessons',
  'promises',
  'words',
  'notes',
  'decisions',
  'prs',
] as const;

export type ListKind = (typeof listKinds)[number];
