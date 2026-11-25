import { expect, test } from 'bun:test';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { isNudgeDue } from './is-nudge-due.ts';

function setupTest() {
  return { nowMs: Date.parse('2026-03-10T11:43:00Z') };
}

test.each([
  {
    title: 'both are 21 minutes old',
    lastWrite: '2026-03-10T11:22:00Z',
    lastNudge: '2026-03-10T11:22:00Z',
    due: true,
  },
  {
    title: 'the last write is 20 minutes old',
    lastWrite: '2026-03-10T11:23:00Z',
    lastNudge: null,
    due: false,
  },
  {
    title: 'the last write is 19 minutes old',
    lastWrite: '2026-03-10T11:24:00Z',
    lastNudge: null,
    due: false,
  },
  {
    title: 'the last nudge is 10 minutes old',
    lastWrite: '2026-03-10T09:00:00Z',
    lastNudge: '2026-03-10T11:33:00Z',
    due: false,
  },
  {
    title: 'the session was never nudged and the write is old',
    lastWrite: '2026-03-10T09:00:00Z',
    lastNudge: null,
    due: true,
  },
  {
    title: 'there was no write and the session started long ago',
    lastWrite: null,
    lastNudge: null,
    due: true,
  },
] as const)('it is $due when $title', (row) => {
  const ctx = setupTest();

  const session = {
    ...buildMockSession({}),
    started: '2026-03-02T08:04:11Z',
    lastWrite: row.lastWrite,
    lastNudge: row.lastNudge,
  };

  expect(isNudgeDue(session, ctx.nowMs)).toBe(row.due);
});
