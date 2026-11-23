import { expect, test } from 'bun:test';
import { buildMockBriefInput } from './build-mock-brief-input.ts';

test('it lays the named fields over an empty brief input', () => {
  const input = buildMockBriefInput({ checks: { kind: 'not-run', count: 2 } });

  expect(input).toStrictEqual({
    session: expect.objectContaining({ name: 'tide-alerts' }),
    items: [],
    ownerNotes: [],
    changed: [],
    pullRequests: [],
    checks: { kind: 'not-run', count: 2 },
    resultsNotSaved: null,
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
  });
});
