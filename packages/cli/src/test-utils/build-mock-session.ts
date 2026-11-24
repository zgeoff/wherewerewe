import type { SessionFile } from '../types.ts';

// The session tide-alerts, started on 2026-03-02 and last written on 2026-03-10, with the item
// t-a in focus since 10:43, and the fields the test names laid over it.
export function buildMockSession(fields: Partial<SessionFile>): SessionFile {
  return {
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: null,
    started: '2026-03-02T08:04:11Z',
    now: 't-a',
    nowNext: 'go',
    nowSet: '2026-03-10T10:43:00Z',
    lastWrite: '2026-03-10T11:02:00Z',
    lastNudge: null,
    importedFrom: null,
    ...fields,
  };
}
