import type { JournalIndex, Store } from '../types.ts';
import { buildMockSession } from './build-mock-session.ts';

// An open session of no items and no rows in the three kind files, with the fields the test names
// laid over it.
export function buildMockStore(fields: Partial<Store>): Store {
  return {
    folder: '/state/wherewerewe/tide-alerts',
    session: buildMockSession({ now: null, nowNext: null, nowSet: null, lastWrite: null }),
    items: [],
    notes: [],
    ownerNotes: [],
    prs: [],
    lessons: [],
    promises: [],
    words: [],
    pin: null,
    notesUnread: null,
    ownerUnread: null,
    prsUnread: null,
    lessonsUnread: null,
    promisesUnread: null,
    wordsUnread: null,
    ...fields,
  };
}

// A journal index with no row, with the fields the test names laid over it.
export function buildMockJournalIndex(fields: Partial<JournalIndex>): JournalIndex {
  return {
    closed: new Map(),
    lastRows: {
      items: new Map(),
      lesson: new Map(),
      promise: new Map(),
      words: new Map(),
    },
    decisions: new Map(),
    replaced: new Set(),
    inForce: [],
    lastDecisionNumber: 0,
    lastOwnerNoteNumber: 0,
    ...fields,
  };
}
