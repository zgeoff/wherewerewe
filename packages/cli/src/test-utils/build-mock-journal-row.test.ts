import { expect, test } from 'bun:test';
import { buildMockJournalRow } from './build-mock-journal-row.ts';

test('it builds an agent row with no text, why or extra', () => {
  const row = buildMockJournalRow({ ts: '2026-03-10T11:43:00Z', op: 'task', id: 't-a' });

  expect(row).toStrictEqual({
    ts: '2026-03-10T11:43:00Z',
    op: 'task',
    id: 't-a',
    by: 'agent',
    text: null,
    why: null,
    extra: null,
  });
});

test('it lays the named fields over the defaults', () => {
  const row = buildMockJournalRow({
    ts: '2026-03-10T11:43:00Z',
    op: 'decide',
    id: 'd-1',
    by: 'owner',
    text: 'a choice',
  });

  expect(row).toStrictEqual({
    ts: '2026-03-10T11:43:00Z',
    op: 'decide',
    id: 'd-1',
    by: 'owner',
    text: 'a choice',
    why: null,
    extra: null,
  });
});
