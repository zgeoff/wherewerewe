import { expect, test } from 'bun:test';
import { buildMockSession } from './build-mock-session.ts';

test('it lays the named fields over a session with t-a in focus', () => {
  expect(buildMockSession({ nowNext: null })).toStrictEqual({
    format: '1',
    name: 'tide-alerts',
    goal: 'Ship it',
    started: '2026-03-02T08:04:11Z',
    now: 't-a',
    nowNext: null,
    nowSet: '2026-03-10T10:43:00Z',
    lastWrite: '2026-03-10T11:02:00Z',
    lastNudge: null,
    importedFrom: null,
  });
});
