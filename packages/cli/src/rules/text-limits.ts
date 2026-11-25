// The most characters each text of a write holds, and the length of an id and a session name,
// which a write checks and `www help` lists. The grant's limits are in grant-limits.ts and the
// most open items of each kind are in item-caps.ts.
export const textLimits = {
  claim: 120,
  note: 400,
  goal: 200,
  nextStep: 120,
  decision: 200,
  why: 200,

  // the text of --evidence on a done and of --for on a use, and of --why on a drop
  closeText: 200,
  ownerNote: 160,
  quote: 120,
  approvalWho: 16,
  approvalWhere: 16,
  approvalScope: 40,
  waitWho: 16,
  idMin: 2,
  idMax: 16,
  lesson: 120,
  lessonWhy: 200,
  promise: 120,
  promiseTo: 16,
  promiseBy: 24,
  words: 300,
  wordsWhere: 40,
  sessionNameMin: 2,
  sessionNameMax: 24,
} as const;
