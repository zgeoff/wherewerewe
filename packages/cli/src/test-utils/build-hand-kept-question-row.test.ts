import { expect, test } from 'bun:test';
import { buildHandKeptQuestionRow } from './build-hand-kept-question-row.ts';

test('it builds an open row, with the time of the cell when it is given', () => {
  expect([
    buildHandKeptQuestionRow({ id: 'q-1', text: 'Which kilns first' }),
    buildHandKeptQuestionRow({ ts: '2026-03-03T08:00:00Z', id: 'q-2', text: 'Which glaze' }),
  ]).toStrictEqual([
    '2026-03-02T10:00:00Z\topen\tq-1\tWhich kilns first',
    '2026-03-03T08:00:00Z\topen\tq-2\tWhich glaze',
  ]);
});
