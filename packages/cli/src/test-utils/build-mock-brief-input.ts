import type { BriefInput } from '../brief/types.ts';

// A brief input for the session tide-alerts at 2026-03-10 11:43 UTC, on day 9, with no items and
// no notes, with the fields the test names laid over it.
export function buildMockBriefInput(fields: Partial<BriefInput>): BriefInput {
  return {
    session: {
      format: '2',
      name: 'tide-alerts',
      goal: 'Ship tide alerts in bosun-api and bosun-app.',
      grant: null,
      started: '2026-03-02T08:04:11Z',
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: '2026-03-10T11:02:00Z',
      lastNudge: null,
      importedFrom: null,
    },
    items: [],
    notes: [],
    ownerNotes: [],
    changed: [],
    pullRequests: [],
    checks: { kind: 'none' },
    resultsNotSaved: null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    sessionFlag: null,
    host: null,
    ...fields,
  };
}
