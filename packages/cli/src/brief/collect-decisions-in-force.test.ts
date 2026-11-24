import { expect, test } from 'bun:test';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { collectDecisionsInForce } from './collect-decisions-in-force.ts';

test('it leaves out a decision that a later decision replaces, and a replacement of a replacement stays in force', () => {
  const rows = [
    buildMockJournalRow({ ts: '2026-03-05T10:00:00Z', op: 'decide', id: 'd-1', text: 'First' }),
    buildMockJournalRow({
      ts: '2026-03-06T10:00:00Z',
      op: 'decide',
      id: 'd-2',
      text: 'Second',
      extra: 'replaces=d-1',
    }),
    buildMockJournalRow({
      ts: '2026-03-07T10:00:00Z',
      op: 'decide',
      id: 'd-3',
      text: 'Third',
      extra: 'replaces=d-2',
    }),
  ];

  expect(collectDecisionsInForce(rows)).toStrictEqual([{ id: 'd-3', choice: 'Third' }]);
});

test('it never counts a ruled-out row, and keeps a decision on a closed item', () => {
  const rows = [
    buildMockJournalRow({
      ts: '2026-03-05T10:00:00Z',
      op: 'decide',
      id: 'd-1',
      text: 'Kept',
      extra: 'on=t-gone',
    }),
    buildMockJournalRow({ ts: '2026-03-05T11:00:00Z', op: 'ruled-out', id: 'd-2', text: 'Never' }),
    buildMockJournalRow({ ts: '2026-03-06T10:00:00Z', op: 'done', id: 't-gone', text: 'x' }),
  ];

  expect(collectDecisionsInForce(rows)).toStrictEqual([{ id: 'd-1', choice: 'Kept' }]);
});

test('it sorts newest first, and the higher number first on a tie of ts', () => {
  const rows = ['d-9', 'd-10', 'd-8'].map((id) =>
    buildMockJournalRow({ ts: '2026-03-05T10:00:00Z', op: 'decide', id, text: id }),
  );

  expect(collectDecisionsInForce(rows).map((row) => row.id)).toStrictEqual(['d-10', 'd-9', 'd-8']);
});
