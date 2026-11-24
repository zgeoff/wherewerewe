import { expect, test } from 'bun:test';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { collectReplacedIDs } from './collect-replaced-ids.ts';

function setupTest() {
  return {
    decide: (id: string, extra: string | null) =>
      buildMockJournalRow({ ts: '2026-03-05T10:00:00Z', op: 'decide', id, text: id, extra }),
    collect: collectReplacedIDs,
  };
}

test('it counts a replacement that comes after the row it names', () => {
  const ctx = setupTest();

  expect(ctx.collect([ctx.decide('d-1', null), ctx.decide('d-2', 'replaces=d-1')])).toStrictEqual(
    new Set(['d-1']),
  );
});

test.each([
  { title: 'a row that names a decision written after it', order: ['d-1:replaces=d-2', 'd-2'] },
  { title: 'a row that names itself', order: ['d-1:replaces=d-1'] },
  { title: 'a row that names an id no row holds', order: ['d-1', 'd-2:replaces=d-9'] },
])('it counts no replacement for $title', (row) => {
  const ctx = setupTest();

  const rows = row.order.map((entry) => {
    const [id = '', extra] = entry.split(':');

    return ctx.decide(id, extra ?? null);
  });

  expect(ctx.collect(rows)).toStrictEqual(new Set());
});
