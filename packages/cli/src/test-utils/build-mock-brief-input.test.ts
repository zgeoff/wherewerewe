import { expect, test } from 'bun:test';
import { buildMockBriefInput } from './build-mock-brief-input.ts';

function setupTest() {
  return { buildMockBriefInput };
}

test('it lays the named fields over an empty brief input', () => {
  const ctx = setupTest();
  const input = ctx.buildMockBriefInput({ checks: { kind: 'not-run', count: 2 } });

  expect(input).toStrictEqual({
    session: expect.objectContaining({ name: 'tide-alerts' }),
    items: [],
    notes: [],
    ownerNotes: [],
    words: [],
    pin: null,
    promises: [],
    lessons: [],
    decisions: [],
    changed: [],
    pullRequests: [],
    checks: { kind: 'not-run', count: 2 },
    resultsNotSaved: null,
    results: new Map(),
    nowHidden: null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    sessionFlag: null,
    host: null,
  });
});
